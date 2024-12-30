import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { createProposal } from "./proposal";
import { createMessage } from "./discussion";
import { createVote } from "./proposal";
import type { PrismaClient } from "@prisma/client";
import { GamePhase } from "~/types/game";

// Helper function to handle AI proposal phase
async function handleAIProposalPhase(
  db: PrismaClient,
  gameId: string,
  aiParticipant: { id: string, civilization: string }
) {
  // Random chance to make a proposal
  if (Math.random() > 0.5) {
    const otherParticipants = await db.gameParticipant.findMany({
      where: {
        gameId,
        id: { not: aiParticipant.id },
      },
    });
    
    // Randomly select recipients
    const recipients = otherParticipants
      .filter(() => Math.random() > 0.5)
      .map(p => p.id);
    
    if (recipients.length > 0) {
      console.log(`[AI-${aiParticipant.id}] Making random proposal`);
      return createProposal(db, {
        gameId,
        senderId: aiParticipant.id,
        recipients,
        type: Math.random() > 0.5 ? "TRADE" : "MILITARY",
        description: `${aiParticipant.civilization} proposes a strategic arrangement`,
        isPublic: Math.random() > 0.7,
      });
    }
  }
}

// Helper function to handle AI voting phase
async function handleAIVotingPhase(
  db: PrismaClient,
  gameId: string,
  aiParticipant: { id: string, civilization: string }
) {
  // Vote on all pending proposals
  const pendingProposals = await db.proposal.findMany({
    where: {
      gameId,
      status: "PENDING",
      // Don't vote on own proposals
      creatorId: { not: aiParticipant.id },
      // Haven't voted yet
      votes: {
        none: {
          participantId: aiParticipant.id
        }
      }
    },
  });

  console.log(`[AI-${aiParticipant.id}] Voting on ${pendingProposals.length} proposals`);
  
  for (const proposal of pendingProposals) {
    await createVote(db, {
      proposalId: proposal.id,
      participantId: aiParticipant.id,
      support: Math.random() > 0.5,
    });
  }
}

// Helper function to handle AI message responses
export async function handleAIMessageResponse(
  db: PrismaClient,
  discussionId: string,
  aiParticipantId: string
) {
  // Verify the participant is an AI
  const aiParticipant = await db.gameParticipant.findFirst({
    where: {
      id: aiParticipantId,
      isAI: true,
    },
    select: {
      id: true,
      civilization: true,
    },
  });

  if (!aiParticipant) {
    throw new Error('Invalid AI participant');
  }

  console.log(`[AI-${aiParticipant.id}] Responding to message`);
  
  return createMessage(db, {
    discussionId,
    senderId: aiParticipant.id,
    content: `${aiParticipant.civilization} acknowledges your message`,
  });
}

// Direct function to handle AI phase actions
export async function handleAIPhaseActions(
  db: PrismaClient,
  gameId: string,
  phase: GamePhase,
  aiParticipantId: string
) {
  // Verify the participant is an AI
  const aiParticipant = await db.gameParticipant.findFirst({
    where: {
      id: aiParticipantId,
      gameId: gameId,
      isAI: true,
    },
    select: {
      id: true,
      civilization: true,
    },
  });

  if (!aiParticipant) {
    throw new Error('Invalid AI participant');
  }

  switch (phase) {
    case GamePhase.PROPOSAL:
      return handleAIProposalPhase(db, gameId, aiParticipant);
    case GamePhase.VOTING:
      return handleAIVotingPhase(db, gameId, aiParticipant);
  }
}

export const aiPlayerRouter = createTRPCRouter({
  // AI makes a proposal
  makeProposal: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        senderId: z.string(),
        recipients: z.array(z.string()),
        type: z.enum(["TRADE", "MILITARY", "ALLIANCE"]),
        description: z.string(),
        isPublic: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the sender is an AI participant
      const sender = await ctx.db.gameParticipant.findFirst({
        where: {
          id: input.senderId,
          isAI: true,
        },
      });

      if (!sender) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid AI participant',
        });
      }

      console.log(`[AI-${input.senderId}] Making proposal`);
      
      // Use the exported proposal creation function
      return createProposal(ctx.db, input);
    }),

  // AI votes on a proposal
  vote: protectedProcedure
    .input(
      z.object({
        proposalId: z.string(),
        participantId: z.string(),
        support: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the participant is an AI
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          id: input.participantId,
          isAI: true,
        },
      });

      if (!participant) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid AI participant',
        });
      }

      console.log(`[AI-${input.participantId}] Voting on proposal`);
      
      // Use the exported vote creation function
      return createVote(ctx.db, input);
    }),

  // AI sends a message
  sendMessage: protectedProcedure
    .input(
      z.object({
        discussionId: z.string(),
        content: z.string(),
        senderId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the sender is an AI participant
      const sender = await ctx.db.gameParticipant.findFirst({
        where: {
          id: input.senderId,
          isAI: true,
        },
      });

      if (!sender) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid AI participant',
        });
      }

      console.log(`[AI-${input.senderId}] Sending message`);
      
      // Use the exported message creation function
      return createMessage(ctx.db, input);
    }),

  // Handle AI turn based on game phase
  handlePhaseActions: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        phase: z.nativeEnum(GamePhase),
        aiParticipantId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return handleAIPhaseActions(
        ctx.db,
        input.gameId,
        input.phase,
        input.aiParticipantId
      );
    }),

  // Handle AI response to a new message
  handleMessageResponse: protectedProcedure
    .input(
      z.object({
        discussionId: z.string(),
        aiParticipantId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return handleAIMessageResponse(ctx.db, input.discussionId, input.aiParticipantId);
    }),
});
