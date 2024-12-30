import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import type { PrismaClient } from "@prisma/client";
import { EventEmitter } from "events";

// Create event emitter for proposal events
export const ee = new EventEmitter();

// Input type for making a proposal
const proposalInput = z.object({
  gameId: z.string(),
  description: z.string(),
  type: z.enum(["TRADE", "MILITARY", "ALLIANCE"]),
  isPublic: z.boolean(),
  senderId: z.string(),
  recipients: z.array(z.string()),
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
      visibleTo: visibleToIds.length > 0 ? {
        connect: visibleToIds.map(id => ({ id }))
      } : undefined,
    },
  });
  ee.emit(`game:${gameId}`, entry);
  return entry;
}

// Core proposal creation logic
export async function createProposal(
  db: PrismaClient,
  input: z.infer<typeof proposalInput>
) {
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
        create: input.recipients.map(recipientId => ({
          participant: { connect: { id: recipientId } },
          role: "RECIPIENT",
        })),
      },
    },
  });

  await updateGameLog(
    db,
    input.gameId,
    `${sender.civilization} made a ${input.isPublic ? 'public' : 'private'} ${input.type} proposal`,
    input.isPublic,
    input.isPublic ? [] : [sender.id, ...input.recipients]
  );

  return proposal;
}

// Core vote creation logic
export async function createVote(
  db: PrismaClient,
  input: z.infer<typeof voteInput>
) {
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
      participants: true,
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

  await updateGameLog(
    db,
    proposal.gameId,
    `${participant.civilization} voted ${input.support ? 'in favor of' : 'against'} the proposal`,
    proposal.isPublic,
    proposal.isPublic ? [] : [participant.id, proposal.creatorId]
  );

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
