import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { GamePhase } from "~/types/game";
import { PROPOSALS_PER_ROUND } from "~/types/game-constants";
import type { PrismaClient } from "@prisma/client";
import { EventEmitter, on } from "events";
import { tracked } from "@trpc/server";
import { handleAIPhaseActions } from "./ai-player";

// Create event emitter for game events
const ee = new EventEmitter();

// Input type for creating a new game
const createGameInput = z.object({
  civilization: z.string(),
});

// Helper function for updating game log
async function updateGameLog(
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

// Helper function to trigger AI actions for all AI players
async function triggerAIActions(
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

export const orchestratorRouter = createTRPCRouter({
  // Get current participant
  getCurrentParticipant: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          userId: ctx.session.user.id,
          isAI: false,
        },
      });

      if (!participant) {
        throw new Error("Not a participant in this game");
      }

      return participant;
    }),

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

      await updateGameLog(ctx.db, game.id, `Game started with ${input.civilization}`);

      // Trigger initial AI actions
      await triggerAIActions(ctx.db, game.id, GamePhase.PROPOSAL);

      return game;
    }),

  // Advance game phase
  advancePhase: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await ctx.db.game.findUnique({
        where: { id: input.gameId },
      });

      if (!game) throw new Error("Game not found");

      const nextPhase = game.phase === GamePhase.SETUP ? GamePhase.PROPOSAL
        : game.phase === GamePhase.PROPOSAL ? GamePhase.DISCUSSION
        : game.phase === GamePhase.DISCUSSION ? GamePhase.VOTING
        : game.phase === GamePhase.VOTING ? GamePhase.RESOLVE
        : game.phase === GamePhase.RESOLVE ? GamePhase.PROPOSAL
        : GamePhase.COMPLETED;

      const shouldIncrementRound = game.phase === GamePhase.RESOLVE;

      const updatedGame = await ctx.db.game.update({
        where: { id: input.gameId },
        data: {
          phase: nextPhase,
          currentRound: shouldIncrementRound ? { increment: 1 } : undefined,
        },
      });

      // Reset remaining proposals when starting a new round
      if (shouldIncrementRound) {
        await ctx.db.gameParticipant.updateMany({
          where: { gameId: input.gameId },
          data: { remainingProposals: PROPOSALS_PER_ROUND },
        });
      }

      await updateGameLog(
        ctx.db,
        input.gameId,
        `Game advanced to ${nextPhase} phase${shouldIncrementRound ? ` (Round ${game.currentRound + 1})` : ''}`
      );

      // Trigger AI actions for the new phase
      await triggerAIActions(ctx.db, input.gameId, nextPhase);

      ee.emit(`game:${input.gameId}`, { type: 'GAME_UPDATE', event: `Game advanced to ${nextPhase} phase${shouldIncrementRound ? ` (Round ${game.currentRound + 1})` : ''}` });

      return updatedGame;
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

  // Subscribe to game updates
  onGameUpdate: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      lastEventId: z.string().nullish(),
    }))
    .subscription(async function* ({ input, ctx }) {
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          userId: ctx.session.user.id,
        },
      });

      if (!participant) return;

      for await (const [update] of on(ee, `game:${input.gameId}`)) {
        if (!update || typeof update !== 'object' || !('id' in update)) continue;
        const updateId = (update as { id: string }).id;
        const typedUpdate = await ctx.db.logEntry.findUnique({
          where: { id: updateId },
          include: { visibleTo: true }
        });
        
        if (typedUpdate?.isPublic || 
            typedUpdate?.visibleTo?.some(p => p.id === participant.id)) {
          yield tracked(typedUpdate.id, typedUpdate);
        }
      }
    }),
});
