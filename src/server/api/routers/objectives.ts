import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

export async function getVisibleObjectives(db: PrismaClient, gameId: string, participantId: string) {
  // Get all participants in the game who have public objectives
  const participantsWithPublicObjectives = await db.gameParticipant.findMany({
    where: {
      gameId: gameId,
      publicObjective: {
        isNot: null,
      },
    },
    include: {
      publicObjective: true,
    },
  });

  // Get the participant's private objective
  const currentParticipant = await db.gameParticipant.findUnique({
    where: {
      id: participantId,
    },
    include: {
      privateObjective: true,
    },
  });

  if (!currentParticipant) {
    throw new Error("Participant not found");
  }

  // Combine all visible objectives
  const publicObjectives = participantsWithPublicObjectives
    .map((p) => p.publicObjective)
    .filter((obj): obj is NonNullable<typeof obj> => obj !== null);

  const privateObjective = currentParticipant.privateObjective;

  return [...publicObjectives, privateObjective].filter((obj): obj is NonNullable<typeof obj> => obj !== null);
}

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
  getVisibleObjectives: protectedProcedure
    .input(z.object({
      gameId: z.string(),
      participantId: z.string()
    }))
    .query( async ({ctx, input}) => {
      return getVisibleObjectives(ctx.db, input.gameId, input.participantId)
    })
});
