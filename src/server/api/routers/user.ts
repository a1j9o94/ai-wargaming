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
});
