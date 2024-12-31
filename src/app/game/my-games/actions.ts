'use server';

import { api } from "~/trpc/server";

export async function markGameAsCompleted(gameId: string) {
  await api.orchestration.markGameAsCompleted({ gameId });
}

export async function getGames() {
  const [activeGames, completedGames] = await Promise.all([
    api.user.getActiveGames(),
    api.user.getCompletedGames(),
  ]);
  return { activeGames, completedGames };
} 