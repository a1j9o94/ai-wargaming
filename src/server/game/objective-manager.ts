import type { PrismaClient, GameParticipant } from "@prisma/client";
import { updateGameLog } from "./logging";
import {
  PUBLIC_OBJECTIVES,
  PRIVATE_OBJECTIVES,
  DEFAULT_PUBLIC_OBJECTIVE,
  DEFAULT_PRIVATE_OBJECTIVE,
  type ObjectiveDefinition
} from "~/types/objective-constants";

export async function assignObjectives(
  db: PrismaClient,
  participants: GameParticipant[]
) {
  const updates = [];

  // Get public objective, with fallback to default
  const availablePublicObjectives = PUBLIC_OBJECTIVES ?? [];
  const selectedPublicObjective: ObjectiveDefinition = availablePublicObjectives.length > 0
    ? availablePublicObjectives[Math.floor(Math.random() * availablePublicObjectives.length)] ?? DEFAULT_PUBLIC_OBJECTIVE
    : DEFAULT_PUBLIC_OBJECTIVE;

  // For each participant
  for (const participant of participants) {
    // Create their public objective
    updates.push(
      db.objective.create({
        data: {
          description: selectedPublicObjective.description(),
          type: selectedPublicObjective.type,
          isPublic: true,
          status: "PENDING",
          publicFor: {
            connect: { id: participant.id }
          },
          // Set target values based on the objective
          targetMight: selectedPublicObjective.target.field === "might" ? 100 : null,
          targetEconomy: selectedPublicObjective.target.field === "economy" ? 100 : null,
        },
      })
    );

    // Select a random opponent for their private objective
    const possibleTargets = participants.filter(p => p.id !== participant.id);
    const targetParticipant = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
    if (!targetParticipant) {
      throw Object.assign(new Error("No valid target participant found"), {
        code: "NO_TARGET_PARTICIPANT"
      } as const);
    }
    
    // Get private objective, with fallback to default
    const availablePrivateObjectives = PRIVATE_OBJECTIVES ?? [];
    const selectedPrivateObjective: ObjectiveDefinition = availablePrivateObjectives.length > 0
      ? availablePrivateObjectives[Math.floor(Math.random() * availablePrivateObjectives.length)] ?? DEFAULT_PRIVATE_OBJECTIVE
      : DEFAULT_PRIVATE_OBJECTIVE;

    // Create their private objective
    updates.push(
      db.objective.create({
        data: {
          description: selectedPrivateObjective.description(targetParticipant),
          type: selectedPrivateObjective.type,
          isPublic: false,
          status: "PENDING",
          privateFor: {
            connect: { id: participant.id }
          },
          targetParticipantId: targetParticipant.id,
          // Set target values based on the objective
          targetMight: selectedPrivateObjective.target.field === "might" ? 0 : null,
          targetEconomy: selectedPrivateObjective.target.field === "economy" ? 0 : null,
        },
      })
    );
  }

  // Execute all objective creations in a transaction
  await db.$transaction(updates);
}

export async function evaluateObjectives(
  db: PrismaClient,
  gameId: string,
  isGameEnd = false
) {
  // Only evaluate objectives at the end of the game
  if (!isGameEnd) {
    return;
  }

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

      // Handle TRADE_DEAL type objective
      if (participant.publicObjective.type === "TRADE_DEAL") {
        const tradeDeals = participants.map(p => p.tradeDealsAccepted);
        const highestTradeDeals = Math.max(0, ...tradeDeals);
        if (participant.tradeDealsAccepted === highestTradeDeals && participant.tradeDealsAccepted > 0) {
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

  // Calculate winner
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
    if (failUpdates.length > 0) {
      await db.$transaction(failUpdates);
    }
    return calculateWinner(db, gameId);
  }
}

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
  
  // Add null check for scores[0] before calculating multiple winners
  const isMultipleWinners = scores[0] ? scores.filter(s => s.score === scores[0]!.score).length > 1 : false;

  if (!winner) return null;

  // Create winner announcement
  if (isMultipleWinners) {
    const winners = scores
      .filter(s => s.score === scores[0]!.score)
      .map(s => s.participant.civilization);

    await updateGameLog(
      db,
      gameId,
      `Game Over! It's a tie between ${winners.join(" and ")} with ${scores[0]!.score} completed objectives!`,
      true
    );
  } else {
    await updateGameLog(
      db,
      gameId,
      `Game Over! ${winner.civilization} wins with ${scores[0]!.score} completed objectives!`,
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