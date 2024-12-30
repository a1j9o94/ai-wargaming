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

// Helper function to calculate winner
async function calculateWinner(
  db: PrismaClient,
  gameId: string
) {
  const participants = await db.gameParticipant.findMany({
    where: { gameId },
    include: {
      publicObjective: true,
      privateObjective: true,
    },
  });

  // Calculate scores for each participant
  const scores = participants.map(participant => {
    let completedObjectives = 0;
    if (participant.publicObjective?.status === "COMPLETED") completedObjectives++;
    if (participant.privateObjective?.status === "COMPLETED") completedObjectives++;

    return {
      participant,
      score: completedObjectives,
      // Use might + economy as tiebreaker
      tiebreaker: participant.might + participant.economy,
    };
  });

  // Sort by score, then by tiebreaker
  scores.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.tiebreaker - a.tiebreaker;
  });

  const winner = scores[0]?.participant;
  const isMultipleWinners = scores.filter(s => s.score === scores[0]?.score).length > 1;

  if (!winner) return null;

  // Create winner announcement
  if (isMultipleWinners) {
    const winners = scores
      .filter(s => s.score === scores[0]?.score)
      .map(s => s.participant.civilization);

    await updateGameLog(
      db,
      gameId,
      `Game Over! It's a tie between ${winners.join(" and ")} with ${scores[0]?.score} completed objectives!`,
      true
    );
  } else {
    await updateGameLog(
      db,
      gameId,
      `Game Over! ${winner.civilization} wins with ${scores[0]?.score} completed objectives!`,
      true
    );
  }

  // Log final scores for all participants
  for (const score of scores) {
    await updateGameLog(
      db,
      gameId,
      `Final score for ${score.participant.civilization}: ${score.score} objectives completed (Might: ${score.participant.might}, Economy: ${score.participant.economy})`,
      true
    );
  }

  return winner.id;
}

// Helper function to evaluate objectives
async function evaluateObjectives(
  db: PrismaClient,
  gameId: string,
  isGameEnd = false
) {
  // Get all participants with their objectives
  const participants = await db.gameParticipant.findMany({
    where: { gameId },
    include: {
      publicObjective: true,
      privateObjective: true,
    },
  });

  const updates = [];

  for (const participant of participants) {
    // Check public objective
    if (participant.publicObjective && participant.publicObjective.status === "PENDING") {
      let completed = false;

      if (participant.publicObjective.targetMight && participant.might >= participant.publicObjective.targetMight) {
        completed = true;
      }
      if (participant.publicObjective.targetEconomy && participant.economy >= participant.publicObjective.targetEconomy) {
        completed = true;
      }
      if (participant.publicObjective.targetParticipantId) {
        const targetParticipant = participants.find(p => p.id === participant.publicObjective?.targetParticipantId);
        if (targetParticipant) {
          // Check if combined might + economy is higher than target's
          const participantTotal = participant.might + participant.economy;
          const targetTotal = targetParticipant.might + targetParticipant.economy;
          if (participantTotal > targetTotal) {
            completed = true;
          }
        }
      }

      if (completed) {
        updates.push(
          db.objective.update({
            where: { id: participant.publicObjective.id },
            data: { status: "COMPLETED" },
          })
        );

        await updateGameLog(
          db,
          gameId,
          `${participant.civilization} completed their public objective: ${participant.publicObjective.description}`,
          true
        );
      }
    }

    // Check private objective
    if (participant.privateObjective && participant.privateObjective.status === "PENDING") {
      let completed = false;

      if (participant.privateObjective.targetMight && participant.might >= participant.privateObjective.targetMight) {
        completed = true;
      }
      if (participant.privateObjective.targetEconomy && participant.economy >= participant.privateObjective.targetEconomy) {
        completed = true;
      }
      if (participant.privateObjective.targetParticipantId) {
        const targetParticipant = participants.find(p => p.id === participant.privateObjective?.targetParticipantId);
        if (targetParticipant) {
          // Example: If objective is to have higher economy than target
          if (participant.economy > targetParticipant.economy) {
            completed = true;
          }
        }
      }

      if (completed) {
        updates.push(
          db.objective.update({
            where: { id: participant.privateObjective.id },
            data: { status: "COMPLETED" },
          })
        );

        await updateGameLog(
          db,
          gameId,
          `${participant.civilization} completed their private objective: ${participant.privateObjective.description}`,
          false,
          [participant.id]
        );
      }
    }
  }

  // Apply all objective updates in a transaction
  if (updates.length > 0) {
    await db.$transaction(updates);
  }

  // If this is the final evaluation, calculate winner
  if (isGameEnd) {
    return calculateWinner(db, gameId);
  }
}

// Helper function to resolve proposals and update player stats
async function resolveProposals(
  db: PrismaClient,
  gameId: string,
  roundNumber: number,
  isGameEnd = false
) {
  // Get all proposals for this round
  const proposals = await db.proposal.findMany({
    where: {
      gameId,
      roundNumber,
      status: "PENDING",
    },
    include: {
      creator: true,
      participants: {
        include: {
          participant: true,
        },
      },
      votes: {
        include: {
          participant: true,
        },
      },
    },
  });

  for (const proposal of proposals) {
    // Calculate if proposal passed (more than 50% support)
    const totalVotes = proposal.votes.length;
    const supportVotes = proposal.votes.filter(v => v.support).length;
    const passed = totalVotes > 0 && supportVotes > totalVotes / 2;

    // Update proposal status
    await db.proposal.update({
      where: { id: proposal.id },
      data: { status: passed ? "ACCEPTED" : "REJECTED" },
    });

    // If proposal passed, apply its effects
    if (passed) {
      const updates = [];
      const allParticipants = [
        proposal.creator,
        ...proposal.participants.map(p => p.participant)
      ];

      switch (proposal.type) {
        case "TRADE":
          // Trade deals boost economy for all participants
          for (const participant of allParticipants) {
            updates.push(
              db.gameParticipant.update({
                where: { id: participant.id },
                data: {
                  economy: {
                    increment: 5,
                  },
                },
              })
            );
          }
          break;

        case "MILITARY":
          // Military deals boost might for all participants
          for (const participant of allParticipants) {
            updates.push(
              db.gameParticipant.update({
                where: { id: participant.id },
                data: {
                  might: {
                    increment: 5,
                  },
                },
              })
            );
          }
          break;

        case "ALLIANCE":
          // Alliances boost both economy and might
          for (const participant of allParticipants) {
            updates.push(
              db.gameParticipant.update({
                where: { id: participant.id },
                data: {
                  economy: {
                    increment: 3,
                  },
                  might: {
                    increment: 3,
                  },
                },
              })
            );
          }
          break;
      }

      // Apply all updates in a transaction
      if (updates.length > 0) {
        await db.$transaction(updates);
      }

      // Log the outcome
      await updateGameLog(
        db,
        gameId,
        `${proposal.type} proposal "${proposal.description}" by ${proposal.creator.civilization} was accepted, benefiting ${allParticipants.map(p => p.civilization).join(", ")}`,
        proposal.isPublic,
        proposal.isPublic ? [] : allParticipants.map(p => p.id)
      );
    } else {
      // Log rejected proposal
      await updateGameLog(
        db,
        gameId,
        `${proposal.type} proposal "${proposal.description}" by ${proposal.creator.civilization} was rejected`,
        proposal.isPublic,
        proposal.isPublic ? [] : [
          proposal.creator.id,
          ...proposal.participants.map(p => p.participant.id)
        ]
      );
    }
  }

  // After all proposals are resolved and stats are updated, evaluate objectives
  return evaluateObjectives(db, gameId, isGameEnd);
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

      // Check if this is the final round (e.g., after 10 rounds)
      const isGameEnd = game.currentRound >= 10 && game.phase === GamePhase.VOTING;

      // If entering resolve phase, resolve all proposals first
      if (nextPhase === GamePhase.RESOLVE) {
        const winnerId = await resolveProposals(ctx.db, input.gameId, game.currentRound, isGameEnd);
        
        if (isGameEnd) {
          // Update game to completed state with winner
          const updatedGame = await ctx.db.game.update({
            where: { id: input.gameId },
            data: {
              phase: GamePhase.COMPLETED,
              winnerId: winnerId ?? undefined,
            },
          });

          ee.emit(`game:${input.gameId}`, { 
            type: 'GAME_UPDATE', 
            event: 'Game completed'
          });

          return updatedGame;
        }

        // Normal round resolution
        const updatedGame = await ctx.db.game.update({
          where: { id: input.gameId },
          data: {
            phase: GamePhase.PROPOSAL,
            currentRound: { increment: 1 },
          },
        });

        // Reset remaining proposals for the new round
        await ctx.db.gameParticipant.updateMany({
          where: { gameId: input.gameId },
          data: { remainingProposals: PROPOSALS_PER_ROUND },
        });

        await updateGameLog(
          ctx.db,
          input.gameId,
          `Round ${game.currentRound} resolved. Starting Round ${game.currentRound + 1}`
        );

        // Trigger AI actions for the new proposal phase
        await triggerAIActions(ctx.db, input.gameId, GamePhase.PROPOSAL);

        ee.emit(`game:${input.gameId}`, { 
          type: 'GAME_UPDATE', 
          event: `Round ${game.currentRound} resolved. Starting Round ${game.currentRound + 1}` 
        });

        return updatedGame;
      }

      // For all other phase transitions
      const updatedGame = await ctx.db.game.update({
        where: { id: input.gameId },
        data: {
          phase: nextPhase,
        },
      });

      await updateGameLog(
        ctx.db,
        input.gameId,
        `Game advanced to ${nextPhase} phase`
      );

      // Trigger AI actions for the new phase
      await triggerAIActions(ctx.db, input.gameId, nextPhase);

      ee.emit(`game:${input.gameId}`, { 
        type: 'GAME_UPDATE', 
        event: `Game advanced to ${nextPhase} phase` 
      });

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
