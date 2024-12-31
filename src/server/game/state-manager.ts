import type { PrismaClient } from "@prisma/client";
import { GamePhase } from "~/types/game";
import { emitGameEvent } from "../events/game-events";
import { resolveProposals } from "./proposal-manager";
import { triggerAIActions } from "../ai/ai-orchestrator";
import { PROPOSALS_PER_ROUND } from "~/types/game-constants";
import { updateGameLog } from "./logging";

export async function advanceGamePhase(
  db: PrismaClient,
  gameId: string
) {
  const game = await db.game.findUnique({
    where: { id: gameId },
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
    const winnerId = await resolveProposals(db, gameId, game.currentRound, isGameEnd);
    
    if (isGameEnd) {
      // Update game to completed state with winner
      const updatedGame = await db.game.update({
        where: { id: gameId },
        data: {
          phase: GamePhase.COMPLETED,
          winnerId: winnerId ?? undefined,
        },
      });

      emitGameEvent(gameId, { 
        type: 'GAME_UPDATE', 
        event: 'Game completed'
      });

      return updatedGame;
    }

    // Normal round resolution
    const updatedGame = await db.game.update({
      where: { id: gameId },
      data: {
        phase: GamePhase.PROPOSAL,
        currentRound: { increment: 1 },
      },
    });

    // Reset remaining proposals for the new round
    await db.gameParticipant.updateMany({
      where: { gameId },
      data: { remainingProposals: PROPOSALS_PER_ROUND },
    });

    await updateGameLog(
      db,
      gameId,
      `Round ${game.currentRound} resolved. Starting Round ${game.currentRound + 1}`
    );

    // Trigger AI actions for the new proposal phase
    await triggerAIActions(db, gameId, GamePhase.PROPOSAL);

    emitGameEvent(gameId, { 
      type: 'GAME_UPDATE', 
      event: `Round ${game.currentRound} resolved. Starting Round ${game.currentRound + 1}` 
    });

    return updatedGame;
  }

  // For all other phase transitions
  const updatedGame = await db.game.update({
    where: { id: gameId },
    data: {
      phase: nextPhase,
    },
  });

  await updateGameLog(
    db,
    gameId,
    `Game advanced to ${nextPhase} phase`
  );

  // Trigger AI actions for the new phase
  await triggerAIActions(db, gameId, nextPhase);

  emitGameEvent(gameId, { 
    type: 'GAME_UPDATE', 
    event: `Game advanced to ${nextPhase} phase` 
  });

  return updatedGame;
} 