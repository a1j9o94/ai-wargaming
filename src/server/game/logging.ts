import type { PrismaClient } from "@prisma/client";
import { emitGameEvent } from "../events/game-events";

export async function updateGameLog(
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