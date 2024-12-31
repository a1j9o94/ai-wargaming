import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { GamePhase } from "~/types/game";
import { PROPOSALS_PER_ROUND } from "~/types/game-constants";
import { assignObjectives } from "~/server/game/objective-manager";
import { updateGameLog } from "~/server/game/logging";
import { triggerAIActions } from "~/server/ai/ai-orchestrator";
import { advanceGamePhase } from "~/server/game/state-manager";

// Input type for creating a new game
const createGameInput = z.object({
  civilization: z.string(),
});

export const orchestrationRouter = createTRPCRouter({
  // Create a new game
  create: protectedProcedure
    .input(createGameInput)
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.game.create({
        data: {
          phase: GamePhase.PROPOSAL,
          currentRound: 1,
          participants: {
            create: [
              {
                civilization: input.civilization,
                userId: ctx.session.user.id,
                isAI: false,
                remainingProposals: PROPOSALS_PER_ROUND,
              },
              // Add AI opponents
              {
                civilization: "Centauri Republic",
                isAI: true,
                remainingProposals: PROPOSALS_PER_ROUND,
              },
              {
                civilization: "Sirius Confederation",
                isAI: true,
                remainingProposals: PROPOSALS_PER_ROUND,
              },
              {
                civilization: "Proxima Alliance",
                isAI: true,
                remainingProposals: PROPOSALS_PER_ROUND,
              },
              {
                civilization: "Vega Dominion",
                isAI: true,
                remainingProposals: PROPOSALS_PER_ROUND,
              },
            ],
          },
        },
        include: {
          participants: true,
        },
      });

      // Assign objectives to all participants
      await assignObjectives(ctx.db, game.participants);

      await updateGameLog(ctx.db, game.id, `Game started with ${input.civilization}`);

      // Trigger initial AI actions
      await triggerAIActions(ctx.db, game.id, GamePhase.PROPOSAL);

      return game;
    }),

  // Advance game phase
  advancePhase: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return advanceGamePhase(ctx.db, input.gameId);
    }),

  // Get current game state
  getGameState: protectedProcedure
    .input(z.object({ gameId: z.string(), participantId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentParticipant = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          id: input.participantId,
        },
      });

      return ctx.db.game.findUnique({
        where: { id: input.gameId },
        include: {
          participants: {
            include: {
              publicObjective: true,
              privateObjective: true,
            },
          },
          proposals: {
            include: {
              creator: true,
              participants: true,
              votes: true,
            },
          },
          discussions: {
            include: {
              participants: true,
              messages: true,
            },
          },
          logEntries: {
            where: {
              OR: [
                // Public entries are visible to everyone
                { isPublic: true },
                // Private entries are only visible if the user is in the visibleTo list
                {
                  AND: [
                    { isPublic: false },
                    {
                      visibleTo: {
                        some: {
                          id: currentParticipant?.id,
                        },
                      },
                    },
                  ],
                },
              ],
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });
    }),

  // Add acknowledgement mutation
  acknowledgeCompletion: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      participantId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          id: input.participantId,
          gameId: input.gameId,
          userId: ctx.session.user.id,
        },
      });

      if (!participant) {
        throw new Error("Not authorized to acknowledge completion for this participant");
      }

      return ctx.db.gameParticipant.update({
        where: { id: input.participantId },
        data: { hasAcknowledgedCompletion: true },
      });
    }),
}); 