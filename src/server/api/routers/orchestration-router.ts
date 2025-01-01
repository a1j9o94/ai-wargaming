import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { GamePhase } from "~/types/game";
import { NUMBER_OF_ROUNDS, PROPOSALS_PER_ROUND } from "~/types/game-constants";
import { assignObjectives } from "~/server/game/objective-manager";
import { updateGameLog } from "~/server/game/logging";
import { triggerAIActions } from "~/server/ai/ai-orchestrator";
import { advanceGamePhase } from "~/server/game/state-manager";
import type { PrismaClient } from "@prisma/client";

// Input type for creating a new game
const createGameInput = z.object({
  civilization: z.string(),
  numberOfRounds: z.number().optional(),
});

export async function getGameContext(db: PrismaClient, gameId: string, participantId: string) {
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      participants: {
        where: {
          id: participantId,
        },
      },
      discussions: {
        where: {
          participants: {
            some: {
              id: participantId,
            },
          },
        },
      },
      proposals: {
        where: {
          participants: {
            some: {
              participantId: participantId,
            },
          },
        },
      },
      logEntries: {
        where: {
          visibleTo: {
            some: {
              id: participantId,
            },
          },
        },
      },
    },
  });
  return game;
}

export const orchestrationRouter = createTRPCRouter({
  // Create a new game
  create: protectedProcedure
    .input(createGameInput)
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.game.create({
        data: {
          phase: GamePhase.SETUP,
          currentRound: 1,
          numberOfRounds: input.numberOfRounds ?? NUMBER_OF_ROUNDS,
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
      await triggerAIActions(ctx.db, game.id, GamePhase.SETUP);

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

  // get the game context for a given participant, filter out discussions, proposals, and log entries that the participant is not authorized to see
  getGameContext: protectedProcedure
    .input(z.object({ gameId: z.string(), participantId: z.string() }))
    .query(async ({ ctx, input }) => {
      return getGameContext(ctx.db, input.gameId, input.participantId);
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

  // Mark game as completed
  markGameAsCompleted: protectedProcedure
      .input(z.object({ gameId: z.string() }))
      .mutation(async ({ ctx, input }) => {
      return ctx.db.game.update({
        where: { id: input.gameId },
        data: { phase: GamePhase.COMPLETED },
      });
    }),
}); 