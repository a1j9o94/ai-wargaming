import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { ProposalRole } from "~/types/game-constants";
import { ee } from "./orchestrator";

// Keep track of last emitted events to prevent duplicates
const lastEmittedEvents = new Map<string, { id: string; timestamp: number }>();

// Helper function to emit events with deduplication
function emitGameEvent(gameId: string, event: unknown) {
  console.log(`[DEBUG] Proposal router emitting event for game ${gameId}:`, {
    eventType: event && typeof event === 'object' && 'type' in event ? (event as { type: string }).type : 'unknown',
    eventId: event && typeof event === 'object' && 'id' in event ? (event as { id: string }).id : undefined
  });

  if (!event || typeof event !== 'object') return;

  const eventId = 'id' in event ? (event as { id: string }).id : undefined;
  const now = Date.now();
  
  // If this is a log entry with an ID, check for duplicates
  if (eventId) {
    const lastEvent = lastEmittedEvents.get(gameId);
    if (lastEvent?.id === eventId && (now - lastEvent.timestamp) < 500) {
      console.log(`[DEBUG] Proposal router skipping duplicate event ${eventId}`);
      return;
    }
    lastEmittedEvents.set(gameId, { id: eventId, timestamp: now });
  }

  ee.emit(`game:${gameId}`, event);
}

// Input type for making a proposal
const proposalInput = z.object({
  gameId: z.string(),
  description: z.string(),
  type: z.enum(["TRADE", "MILITARY", "ALLIANCE"]),
  isPublic: z.boolean(),
  senderId: z.string(),
  participants: z.array(z.string()),
  targets: z.array(z.string()),
});

// Input type for voting
const voteInput = z.object({
  proposalId: z.string(),
  support: z.boolean(),
  participantId: z.string(),
});

// Helper function for updating game log
export async function updateGameLog(
  db: PrismaClient,
  gameId: string,
  message: string,
  isPublic = true,
  visibleToIds: string[] = []
) {
  const entry = await db.logEntry.create({
    data: {
      game: { connect: { id: gameId } },
      event: message,
      time: new Date().toISOString(),
      isPublic,
      visibleTo: !isPublic && visibleToIds.length > 0 ? {
        connect: visibleToIds.map(id => ({ id }))
      } : undefined,
    },
  });
  
  emitGameEvent(gameId, entry);
  return entry;
}

// Core proposal creation logic
export async function createProposal(
  db: PrismaClient,
  input: z.infer<typeof proposalInput>
) {
  console.log(`[DEBUG] Creating proposal for game ${input.gameId}:`, {
    type: input.type,
    senderId: input.senderId,
    participantCount: input.participants.length,
    targetCount: input.targets.length
  });

  // Validate that a participant is not also a target
  const overlap = input.participants.filter(p => input.targets.includes(p));
  if (overlap.length > 0) {
    console.log(`[DEBUG] Proposal creation failed - participant/target overlap:`, overlap);
    throw new Error("A participant cannot also be a target");
  }

  const sender = await db.gameParticipant.findFirst({
    where: {
      gameId: input.gameId,
      id: input.senderId,
    },
    select: {
      id: true,
      civilization: true,
      remainingProposals: true,
    },
  });

  if (!sender) throw new Error("Not a participant in this game");
  if (sender.remainingProposals <= 0) throw new Error("No remaining proposals for this round");

  const game = await db.game.findUnique({
    where: { id: input.gameId },
    select: { currentRound: true },
  });

  if (!game) throw new Error("Game not found");

  // Update remaining proposals
  await db.gameParticipant.update({
    where: { id: sender.id },
    data: { remainingProposals: sender.remainingProposals - 1 },
  });

  const proposal = await db.proposal.create({
    data: {
      game: { connect: { id: input.gameId } },
      creator: { connect: { id: sender.id } },
      description: input.description,
      type: input.type,
      isPublic: input.isPublic,
      roundNumber: game.currentRound,
      participants: {
        create: [
          // Add creator as a participant
          {
            participant: { connect: { id: sender.id } },
            role: ProposalRole.CREATOR,
          },
          // Add other participants
          ...input.participants.map(participantId => ({
            participant: { connect: { id: participantId } },
            role: ProposalRole.PARTICIPANT,
          })),
        ],
      },
    },
  });

  // Create targets separately after proposal exists
  if (input.targets.length > 0) {
    await db.proposalParticipant.createMany({
      data: input.targets.map(targetId => ({
        proposalId: proposal.id,
        participantId: targetId,
        role: ProposalRole.TARGET,
      })),
    });
  }

  // Create log entry - public proposals are visible to everyone, private ones only to participants (not targets)
  await updateGameLog(
    db,
    input.gameId,
    `${sender.civilization} made a ${input.isPublic ? 'public' : 'private'} ${input.type} proposal`,
    input.isPublic,
    input.isPublic ? [] : [sender.id, ...input.participants]
  );

  console.log(`[DEBUG] Proposal created successfully:`, {
    proposalId: proposal.id,
    gameId: input.gameId,
    type: input.type
  });

  return proposal;
}

// Core vote creation logic
export async function createVote(
  db: PrismaClient,
  input: z.infer<typeof voteInput>
) {
  console.log(`[DEBUG] Creating vote:`, {
    proposalId: input.proposalId,
    participantId: input.participantId,
    support: input.support
  });

  const participant = await db.gameParticipant.findFirst({
    where: {
      game: {
        proposals: {
          some: { id: input.proposalId },
        },
      },
      id: input.participantId,
    },
  });

  if (!participant) throw new Error("Not a participant in this game");

  const proposal = await db.proposal.findUnique({
    where: { id: input.proposalId },
    include: {
      game: true,
      creator: true,
      participants: {
        select: {
          participant: {
            select: {
              id: true,
              civilization: true,
            },
          },
        },
      },
      votes: true,
    },
  });

  if (!proposal) throw new Error("Proposal not found");

  const vote = await db.vote.create({
    data: {
      proposal: { connect: { id: input.proposalId } },
      participant: { connect: { id: participant.id } },
      support: input.support,
    },
  });

  // Create log entry - public votes are visible to everyone, private ones only to proposal participants
  await updateGameLog(
    db,
    proposal.gameId,
    `${participant.civilization} voted ${input.support ? 'in favor of' : 'against'} the proposal`,
    proposal.isPublic,
    proposal.isPublic ? [] : [
      proposal.creatorId,
      ...proposal.participants.map(p => p.participant.id)
    ]
  );

  console.log(`[DEBUG] Vote created successfully:`, {
    voteId: vote.id,
    proposalId: input.proposalId,
    support: input.support
  });

  return vote;
}

export const proposalRouter = createTRPCRouter({
  // Make a proposal
  makeProposal: protectedProcedure
    .input(proposalInput)
    .mutation(async ({ ctx, input }) => {
      return createProposal(ctx.db, input);
    }),

  // Vote on a proposal
  vote: protectedProcedure
    .input(voteInput)
    .mutation(async ({ ctx, input }) => {
      return createVote(ctx.db, input);
    }),
});
