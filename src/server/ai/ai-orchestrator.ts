import type { PrismaClient } from "@prisma/client";
import { GamePhase } from "~/types/game";
import { handleAIPhaseActions, handleAIMessageResponse } from "./ai-player";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { z } from "zod";
import { createProposal } from "~/server/api/routers/proposal";
import { createMessage } from "~/server/api/routers/discussion";
import { createVote } from "~/server/api/routers/proposal";

export async function triggerAIActions(
  db: PrismaClient,
  gameId: string,
  phase: GamePhase
) {
  const aiParticipants = await db.gameParticipant.findMany({
    where: {
      gameId,
      isAI: true,
    },
  });

  // Only trigger actions in relevant phases
  if (phase === GamePhase.PROPOSAL || phase === GamePhase.VOTING) {
    for (const ai of aiParticipants) {
      await handleAIPhaseActions(db, gameId, phase, ai.id);
    }
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
      return createProposal(ctx.db, {
        gameId: input.gameId,
        senderId: input.senderId,
        participants: input.recipients,
        targets: [],
        type: input.type,
        description: input.description,
        isPublic: input.isPublic,
      });
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