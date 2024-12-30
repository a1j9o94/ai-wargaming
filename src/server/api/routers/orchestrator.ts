import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { GamePhase } from "~/types/game";
import { PROPOSALS_PER_ROUND } from "~/types/game-constants";
import type { PrismaClient, GameParticipant } from "@prisma/client";
import { EventEmitter, on } from "events";
import { tracked } from "@trpc/server";
import { handleAIPhaseActions } from "./ai-player";
import { PUBLIC_OBJECTIVES, PRIVATE_OBJECTIVES } from "~/types/objective-constants";

// Create event emitter for game events
export const ee = new EventEmitter();
ee.setMaxListeners(20); // Increase max listeners to prevent warnings

// Debug logging for event emitter
ee.on('newListener', (event) => {
  console.log(`[DEBUG] New listener added for event: ${event}`);
});

ee.on('removeListener', (event) => {
  console.log(`[DEBUG] Listener removed for event: ${event}`);
});

// Keep track of last emitted events per game to prevent duplicates
const lastEmittedEvents = new Map<string, { id: string; timestamp: number }>();

// Helper function to emit game events with deduplication
function emitGameEvent(gameId: string, event: unknown) {
  if (!event || typeof event !== 'object') return;

  const eventId = 'id' in event ? (event as { id: string }).id : undefined;
  const now = Date.now();
  
  console.log(`[DEBUG] Attempting to emit event for game ${gameId}:`, {
    eventId,
    eventType: event && typeof event === 'object' && 'type' in event ? (event as { type: string }).type : 'unknown',
    timestamp: now
  });
  
  // If this is a log entry with an ID, check for duplicates
  if (eventId) {
    const lastEvent = lastEmittedEvents.get(gameId);
    // Prevent duplicate events within 1000ms and batch rapid updates
    if (lastEvent?.id === eventId && (now - lastEvent.timestamp) < 1000) {
      console.log(`[DEBUG] Skipping duplicate event ${eventId} (last emission was ${now - lastEvent.timestamp}ms ago)`);
      return;
    }
    lastEmittedEvents.set(gameId, { id: eventId, timestamp: now });

    // Use a longer debounce time for updates
    const debounceTime = 250;
    console.log(`[DEBUG] Scheduling debounced event emission for ${eventId} in ${debounceTime}ms`);
    setTimeout(() => {
      // Check again if this event is still relevant
      const currentLastEvent = lastEmittedEvents.get(gameId);
      if (currentLastEvent?.id === eventId) {
        console.log(`[DEBUG] Emitting debounced event ${eventId}`);
        ee.emit(`game:${gameId}`, event);
      } else {
        console.log(`[DEBUG] Skipping outdated debounced event ${eventId}`);
      }
    }, debounceTime);
  } else {
    console.log(`[DEBUG] Emitting non-tracked event for game ${gameId}`);
    ee.emit(`game:${gameId}`, event);
  }
}

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
  
  emitGameEvent(gameId, entry);
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

      // Handle HIGHEST constraint
      if (participant.publicObjective.targetMight && participant.publicObjective.targetMight > 0) {
        const highestMight = Math.max(...participants.map(p => p.might));
        if (participant.might >= participant.publicObjective.targetMight && participant.might === highestMight) {
          completed = true;
        }
      }
      if (participant.publicObjective.targetEconomy && participant.publicObjective.targetEconomy > 0) {
        const highestEconomy = Math.max(...participants.map(p => p.economy));
        if (participant.economy >= participant.publicObjective.targetEconomy && participant.economy === highestEconomy) {
          completed = true;
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

      if (participant.privateObjective.targetParticipantId) {
        const targetParticipant = participants.find(p => p.id === participant.privateObjective?.targetParticipantId);
        if (targetParticipant) {
          // Handle LOWEST constraint for specific player
          if (participant.privateObjective.targetMight === 0) {
            const lowestMight = Math.min(...participants.map(p => p.might));
            if (targetParticipant.might === lowestMight) {
              completed = true;
            }
          }
          if (participant.privateObjective.targetEconomy === 0) {
            const lowestEconomy = Math.min(...participants.map(p => p.economy));
            if (targetParticipant.economy === lowestEconomy) {
              completed = true;
            }
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
    // Mark any remaining PENDING objectives as FAILED
    const failUpdates = [];
    for (const participant of participants) {
      if (participant.publicObjective?.status === "PENDING") {
        failUpdates.push(
          db.objective.update({
            where: { id: participant.publicObjective.id },
            data: { status: "FAILED" },
          })
        );
      }
      if (participant.privateObjective?.status === "PENDING") {
        failUpdates.push(
          db.objective.update({
            where: { id: participant.privateObjective.id },
            data: { status: "FAILED" },
          })
        );
      }
    }
    if (failUpdates.length > 0) {
      await db.$transaction(failUpdates);
    }
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

// Helper function to assign objectives to participants
async function assignObjectives(
  db: PrismaClient,
  participants: GameParticipant[]
) {
  const updates = [];

  // Randomly select a public objective with a default
  const publicObjective = PUBLIC_OBJECTIVES[Math.floor(Math.random() * PUBLIC_OBJECTIVES.length)] ?? PUBLIC_OBJECTIVES[0];
  if (!publicObjective) throw new Error("No public objectives defined");

  // For each participant
  for (const participant of participants) {
    // Create their public objective
    updates.push(
      db.objective.create({
        data: {
          description: publicObjective.description(),
          type: publicObjective.type,
          isPublic: true,
          status: "PENDING",
          publicFor: {
            connect: { id: participant.id }
          },
          // Set target values based on the objective
          targetMight: publicObjective.target.field === "might" ? 100 : null,
          targetEconomy: publicObjective.target.field === "economy" ? 100 : null,
        },
      })
    );

    // Select a random opponent for their private objective
    const possibleTargets = participants.filter(p => p.id !== participant.id);
    const targetParticipant = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    if (!targetParticipant) throw new Error("No valid target participant found");
    
    // Randomly select a private objective with a default
    const privateObjective = PRIVATE_OBJECTIVES[Math.floor(Math.random() * PRIVATE_OBJECTIVES.length)] ?? PRIVATE_OBJECTIVES[0];
    if (!privateObjective) throw new Error("No private objectives defined");

    // Create their private objective
    updates.push(
      db.objective.create({
        data: {
          description: privateObjective.description(targetParticipant),
          type: privateObjective.type,
          isPublic: false,
          status: "PENDING",
          privateFor: {
            connect: { id: participant.id }
          },
          targetParticipantId: targetParticipant.id,
          // Set target values based on the objective
          targetMight: privateObjective.target.field === "might" ? 0 : null,
          targetEconomy: privateObjective.target.field === "economy" ? 0 : null,
        },
      })
    );
  }

  // Execute all objective creations in a transaction
  await db.$transaction(updates);
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

  // Get participant objectives
  getParticipantObjectives: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      participantId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const participant = await ctx.db.gameParticipant.findUnique({
        where: { id: input.participantId },
        include: {
          publicObjective: true,
          privateObjective: true,
        },
      });

      if (!participant) {
        throw new Error("Participant not found");
      }

      return {
        publicObjective: participant.publicObjective,
        privateObjective: participant.privateObjective,
      };
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

          emitGameEvent(input.gameId, { 
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

        emitGameEvent(input.gameId, { 
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

      emitGameEvent(input.gameId, { 
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
      console.log(`[DEBUG] New subscription started for game ${input.gameId}`);
      
      type GameUpdate = {
        type: 'GAME_UPDATE';
        event: string;
      };

      type LogEntry = {
        id: string;
        isPublic?: boolean;
        visibleTo?: { id: string }[];
      };

      // Cache the participant check result
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          userId: ctx.session.user.id,
        },
        select: { id: true },
      });

      if (!participant) {
        console.log(`[DEBUG] Subscription rejected - no participant found for game ${input.gameId}`);
        return;
      }

      console.log(`[DEBUG] Subscription authorized for participant ${participant.id} in game ${input.gameId}`);

      // Create a cleanup function that removes specific listeners
      const errorHandler = (err: Error) => {
        console.log(`[DEBUG] Error in game subscription for ${input.gameId}:`, err);
      };

      const updateHandler = (update: unknown) => {
        console.log(`[DEBUG] Received update for game ${input.gameId}:`, {
          updateType: update && typeof update === 'object' && 'type' in update ? (update as { type: string }).type : 'unknown',
          updateId: update && typeof update === 'object' && 'id' in update ? (update as { id: string }).id : undefined
        });
      };

      // Add listeners
      ee.on(`game:${input.gameId}`, updateHandler);
      ee.on('error', errorHandler);

      const cleanup = () => {
        console.log(`[DEBUG] Cleaning up subscription for game ${input.gameId}`);
        ee.off(`game:${input.gameId}`, updateHandler);
        ee.off('error', errorHandler);
      };

      try {
        // Use a more efficient event handling approach
        for await (const [update] of on(ee, `game:${input.gameId}`)) {
          // Skip invalid updates early
          if (!update || typeof update !== 'object') continue;

          // Handle different types of updates
          if (update && typeof update === 'object' && 'type' in update && 
              (update as GameUpdate).type === 'GAME_UPDATE') {
            const gameUpdate = update as GameUpdate;
            yield tracked(gameUpdate.event, gameUpdate);
          } else if (update && typeof update === 'object' && 'id' in update) {
            // For log entries, only fetch if necessary
            const logEntry = update as LogEntry;
            
            // If we already know it's public, yield immediately
            if (logEntry.isPublic) {
              yield tracked(logEntry.id, logEntry);
              continue;
            }

            // Only query the database if we need to check visibility
            const typedUpdate = await ctx.db.logEntry.findUnique({
              where: { id: logEntry.id },
              select: {
                id: true,
                isPublic: true,
                visibleTo: {
                  select: { id: true }
                }
              }
            });
            
            if (typedUpdate?.isPublic || 
                typedUpdate?.visibleTo?.some(p => p.id === participant.id)) {
              yield tracked(typedUpdate.id, typedUpdate);
            }
          }
        }
      } catch (err) {
        console.error(`[DEBUG] Subscription error for game ${input.gameId}:`, err);
      } finally {
        cleanup();
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
