import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { GamePhase } from "~/types/game";
import type { PrismaClient } from "@prisma/client";
import { EventEmitter, on} from "events";
import { tracked } from "@trpc/server";

// Input type for creating a new game
const createGameInput = z.object({
  civilization: z.string(),
});

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

// Input type for sending a message
const messageInput = z.object({
  discussionId: z.string(),
  content: z.string(),
  senderId: z.string(),
});

// Input type for updating discussion participants
const updateDiscussionInput = z.object({
  discussionId: z.string(),
  participantIds: z.array(z.string()),
  gameId: z.string(),
});

// Helper function at the top
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

// Create event emitter for game events
const ee = new EventEmitter();

export const gameRouter = createTRPCRouter({
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
              },
              // Add AI opponents
              {
                civilization: "Centauri Republic",
                isAI: true,
              },
              {
                civilization: "Sirius Confederation",
                isAI: true,
              },
              {
                civilization: "Proxima Alliance",
                isAI: true,
              },
              {
                civilization: "Vega Dominion",
                isAI: true,
              },
            ],
          },
        },
        include: {
          participants: true,
        },
      });

      await updateGameLog(ctx.db, game.id, `Game started with ${input.civilization}`);

      return game;
    }),

  // Get current game state
  getGameState: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      const currentParticipant = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          userId: ctx.session.user.id,
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

  // Make a proposal
  makeProposal: protectedProcedure
    .input(proposalInput)
    .mutation(async ({ ctx, input }) => {
      const sender = await ctx.db.gameParticipant.findFirst({
        where: {
          gameId: input.gameId,
          id: input.senderId,
        },
      });

      if (!sender) throw new Error("Not a participant in this game");

      const game = await ctx.db.game.findUnique({
        where: { id: input.gameId },
        select: { currentRound: true },
      });

      if (!game) throw new Error("Game not found");

      const proposal = await ctx.db.proposal.create({
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
        ctx.db,
        input.gameId,
        `${sender.civilization} made a ${input.isPublic ? 'public' : 'private'} ${input.type} proposal`,
        input.isPublic,
        input.isPublic ? [] : [sender.id, ...input.recipients]
      );

      return proposal;
    }),

  // Vote on a proposal
  vote: protectedProcedure
    .input(voteInput)
    .mutation(async ({ ctx, input }) => {
      const participant = await ctx.db.gameParticipant.findFirst({
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

      const proposal = await ctx.db.proposal.findUnique({
        where: { id: input.proposalId },
        include: {
          game: true,
          creator: true,
          participants: true,
          votes: true,
        },
      });

      if (!proposal) throw new Error("Proposal not found");

      const vote = await ctx.db.vote.create({
        data: {
          proposal: { connect: { id: input.proposalId } },
          participant: { connect: { id: participant.id } },
          support: input.support,
        },
      });

      await updateGameLog(
        ctx.db,
        proposal.gameId,
        `${participant.civilization} voted ${input.support ? 'in favor of' : 'against'} the proposal`,
        proposal.isPublic,
        proposal.isPublic ? [] : [participant.id, proposal.creatorId]
      );

      return vote;
    }),

  // Send a message in a discussion
  sendMessage: protectedProcedure
    .input(messageInput)
    .mutation(async ({ ctx, input }) => {
      const discussion = await ctx.db.discussion.findUnique({
        where: { id: input.discussionId },
        include: {
          participants: true,
        },
      });

      if (!discussion) throw new Error("Discussion not found");

      const sender = await ctx.db.gameParticipant.findFirst({
        where: {
          id: input.senderId,
          gameId: discussion.gameId,
        },
      });

      if (!sender) throw new Error("Sender not found");

      const message = await ctx.db.chatMessage.create({
        data: {
          content: input.content,
          discussion: { connect: { id: input.discussionId } },
          sender: { connect: { id: sender.id } },
          User: sender.userId ? { connect: { id: sender.userId } } : undefined,
        },
      });

      const chatMessage = {
        id: message.id,
        content: message.content,
        senderId: input.senderId,
        timestamp: message.createdAt.toISOString()
      };

      ee.emit(`chat:${input.discussionId}`, chatMessage);
      return message;
    }),

  // Update discussion participants
  updateDiscussionParticipants: protectedProcedure
    .input(updateDiscussionInput)
    .mutation(async ({ ctx, input }) => {
      // If discussionId is -1, create a new discussion
      if (input.discussionId === "-1") {
        const discussion = await ctx.db.discussion.create({
          data: {
            game: { connect: { id: input.gameId }},
            participants: {
              connect: input.participantIds.map(id => ({ id })),
            },
          },
          include: {
            participants: true,
          },
        });

        await updateGameLog(
          ctx.db,
          discussion.gameId,
          `New discussion created`,
          false,
          discussion.participants.map(p => p.id)
        );

        return discussion;
      }

      // Otherwise, update existing discussion
      const discussion = await ctx.db.discussion.update({
        where: { id: input.discussionId },
        data: {
          participants: {
            set: [], // First clear existing participants
            connect: input.participantIds.map(id => ({ id })), // Then add new ones
          },
        },
        include: {
          participants: true,
        },
      });

      await updateGameLog(
        ctx.db,
        discussion.gameId,
        `Discussion participants updated`,
        false,
        discussion.participants.map(p => p.id)
      );

      return discussion;
    }),

  //get a discussion based on a game id and a list of participant ids
  getDiscussion: protectedProcedure
    .input(z.object({ gameId: z.string(), participantIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      // Find discussion where ALL participants match exactly (no more, no less)
      const discussion = await ctx.db.discussion.findFirst({
        where: { 
          gameId: input.gameId,
          AND: [
            // Must have all the requested participants
            ...input.participantIds.map(id => ({
              participants: { some: { id } }
            })),
            // Must not have any other participants
            {
              participants: {
                every: {
                  id: { in: input.participantIds }
                }
              }
            }
          ]
        },
        include: {
          messages: true,
          participants: true,
        },
      });

      if (!discussion) {
        const newDiscussion = await ctx.db.discussion.create({
          data: { 
            gameId: input.gameId, 
            participants: { 
              connect: input.participantIds.map(id => ({ id })) 
            } 
          },
          include: {
            messages: true,
            participants: true,
          },
        });
        return newDiscussion;
      }
      return discussion;
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

      await ctx.db.game.update({
        where: { id: input.gameId },
        data: {
          phase: nextPhase,
          currentRound: shouldIncrementRound ? { increment: 1 } : undefined,
        },
      });

      await updateGameLog(
        ctx.db,
        input.gameId,
        `Game advanced to ${nextPhase} phase${shouldIncrementRound ? ` (Round ${game.currentRound + 1})` : ''}`
      );

      ee.emit(`game:${input.gameId}`, { type: 'GAME_UPDATE', event: `Game advanced to ${nextPhase} phase${shouldIncrementRound ? ` (Round ${game.currentRound + 1})` : ''}` });

      return game;
    }),

  // Add these subscription procedures to gameRouter:
  onNewMessage: protectedProcedure
    .input(z.object({
      discussionId: z.string(),
      lastEventId: z.string().nullish(),
    }))
    .subscription(async function* ({ input, ctx }) {
      // Skip if discussionId is 0 (invalid)
      if (input.discussionId === "0") {
        yield { type: 'error', message: 'Invalid discussion ID' };
        return;
      }

      const discussion = await ctx.db.discussion.findUnique({
        where: { id: input.discussionId },
        include: { participants: true },
      });

      // Handle non-existent discussion
      if (!discussion) {
        yield { type: 'error', message: `Discussion ${input.discussionId} not found` };
        return;
      }

      // Verify the user is a participant
      const isParticipant = discussion.participants.some(p => p.userId === ctx.session.user.id);
      if (!isParticipant) {
        yield { type: 'error', message: 'Not authorized to view this discussion' };
        return;
      }

      // If we get here, everything is valid - subscribe to messages
      for await (const [message] of on(ee, `chat:${input.discussionId}`)) {
        try {
          yield message;
        } catch (error) {
          console.error('Error processing message:', error);
          yield { type: 'error', message: 'Error processing message' };
        }
      }
    }),

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
    })
}); 