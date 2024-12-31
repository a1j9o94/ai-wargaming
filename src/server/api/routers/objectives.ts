import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export const objectivesRouter = createTRPCRouter({
  getParticipantObjectives: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        participantId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const participant = await ctx.db.gameParticipant.findFirst({
        where: {
          id: input.participantId,
          gameId: input.gameId,
        },
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
});
