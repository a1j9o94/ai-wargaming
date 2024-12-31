import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { EventEmitter, on } from "events";
import type { PrismaClient } from "@prisma/client";
import { handleAIMessageResponse } from "~/server/ai/ai-player";

// Create event emitter for discussion events
export const ee = new EventEmitter();

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

// Helper function to trigger AI responses to a message
async function triggerAIResponses(
  db: PrismaClient,
  discussionId: string,
  senderId: string
) {
  // Get all AI participants in the discussion except the sender
  const discussion = await db.discussion.findUnique({
    where: { id: discussionId },
    include: {
      participants: {
        where: {
          isAI: true,
          id: { not: senderId },
        },
      },
    },
  });

  if (!discussion) return;

  // Have each AI respond to the message
  for (const ai of discussion.participants) {
    await handleAIMessageResponse(db, discussionId, ai.id);
  }
}

// Core message creation logic
export async function createMessage(
  db: PrismaClient,
  input: z.infer<typeof messageInput>
) {
  const discussion = await db.discussion.findUnique({
    where: { id: input.discussionId },
    include: {
      participants: true,
    },
  });

  if (!discussion) throw new Error("Discussion not found");

  const sender = await db.gameParticipant.findFirst({
    where: {
      id: input.senderId,
      gameId: discussion.gameId,
    },
  });

  if (!sender) throw new Error("Sender not found");

  const message = await db.chatMessage.create({
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

  // Trigger AI responses if the sender is not an AI
  if (!sender.isAI) {
    await triggerAIResponses(db, input.discussionId, input.senderId);
  }

  return message;
}

// Core discussion update logic
export async function updateDiscussion(
  db: PrismaClient,
  input: z.infer<typeof updateDiscussionInput>
) {
  // If discussionId is -1, create a new discussion
  if (input.discussionId === "-1") {
    const discussion = await db.discussion.create({
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

    return discussion;
  }

  // Otherwise, update existing discussion
  const discussion = await db.discussion.update({
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

  return discussion;
}

export const discussionRouter = createTRPCRouter({
  // Send a message in a discussion
  sendMessage: protectedProcedure
    .input(messageInput)
    .mutation(async ({ ctx, input }) => {
      return createMessage(ctx.db, input);
    }),

  // Update discussion participants
  updateDiscussionParticipants: protectedProcedure
    .input(updateDiscussionInput)
    .mutation(async ({ ctx, input }) => {
      return updateDiscussion(ctx.db, input);
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

  // Subscribe to new messages
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
      try {
        for await (const [message] of on(ee, `chat:${input.discussionId}`)) {
          yield message;
        }
      } catch (error) {
        console.error('Error processing message:', error);
        yield { type: 'error', message: 'Error processing message' };
      }
    }),
});
