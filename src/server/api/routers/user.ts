import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";

export const userRouter = createTRPCRouter({
  // Get current user profile
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.user.findUnique({
        where: { id: ctx.session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });
    }),

  // Update user profile
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2, "Name must be at least 2 characters"),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: {
          name: input.name,
        },
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      });
    }),

  // Get active games for current user
  getActiveGames: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.game.findMany({
        where: {
          participants: {
            some: {
              userId: ctx.session.user.id,
            },
          },
          phase: {
            not: "COMPLETED",
          },
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              proposals: true,
              discussions: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    }),

  // Get completed games for current user
  getCompletedGames: protectedProcedure
    .query(async ({ ctx }) => {
      return ctx.db.game.findMany({
        where: {
          participants: {
            some: {
              userId: ctx.session.user.id,
            },
          },
          phase: "COMPLETED",
        },
        include: {
          participants: {
            include: {
              user: true,
            },
          },
          _count: {
            select: {
              proposals: true,
              discussions: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    }),

  // Get current participant for a game
  getCurrentParticipant: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ ctx, input }) => {
      //check if the game exists and if the user is a participant
      const game = await ctx.db.game.findUnique({
        where: { id: input.gameId },
      });
      if (!game) {
        throw new Error("Game not found");
      }

      const participant = await ctx.db.gameParticipant.findFirst({
        where: { gameId: input.gameId, userId: ctx.session.user.id },
      });

      if (!participant) {
        throw new Error("User is not a participant in this game");
      }

      return participant;
    }),
});
