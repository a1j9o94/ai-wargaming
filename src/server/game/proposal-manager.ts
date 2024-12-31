import type { PrismaClient } from "@prisma/client";
import { ProposalRole } from "~/types/game-constants";
import { updateGameLog } from "./logging";
import {
  MILITARY_OUTCOMES,
  TRADE_OUTCOMES,
  ALLIANCE_OUTCOMES,
  calculateMilitaryOutcome,
  applyGroupOutcomeEffect,
  applyOutcomeEffect,
  distributeSpoils,
} from "~/types/proposal-outcomes";
import { evaluateObjectives } from "./objective-manager";

export async function resolveProposals(
  db: PrismaClient,
  gameId: string,
  roundNumber: number,
  isGameEnd = false
) {
  // Get all proposals for this round with full participant details
  const proposals = await db.proposal.findMany({
    where: {
      gameId,
      roundNumber,
      status: "PENDING",
    },
    include: {
      creator: true,
      participants: {
        include: {
          participant: true,
        },
      },
      targets: {
        include: {
          participant: true,
        },
      },
      votes: {
        include: {
          participant: true,
        },
      },
    },
  });

  for (const proposal of proposals) {
    // Calculate if proposal passed (more than 50% support from participants)
    const participantIds = proposal.participants
      .filter(p => p.role === ProposalRole.PARTICIPANT || p.role === ProposalRole.CREATOR)
      .map(p => p.participant.id);
    
    const relevantVotes = proposal.votes.filter(v => participantIds.includes(v.participant.id));
    const totalVotes = relevantVotes.length;
    const supportVotes = relevantVotes.filter(v => v.support).length;
    const passed = totalVotes > 0 && supportVotes > totalVotes / 2;

    // Update proposal status
    await db.proposal.update({
      where: { id: proposal.id },
      data: { status: passed ? "ACCEPTED" : "REJECTED" },
    });

    // If proposal passed, apply its effects
    if (passed) {
      const updates = [];
      const participants = proposal.participants
        .filter(p => p.role === ProposalRole.PARTICIPANT || p.role === ProposalRole.CREATOR)
        .map(p => p.participant);
      const targets = proposal.targets.map(t => t.participant);

      switch (proposal.type) {
        case "MILITARY": {
          // Check if targets are also attacking (have voted in support)
          const defendersAttacking = targets.some(target => 
            proposal.votes.some(v => v.participant.id === target.id && v.support)
          );

          // Determine battle outcome
          const attackersWin = calculateMilitaryOutcome(participants, targets, defendersAttacking);

          if (attackersWin) {
            // Calculate total spoils from defenders
            const totalSpoils = targets.reduce((sum, target) => 
              sum + Math.floor(target.economy * 0.3), 0);
            const spoilsDistribution = distributeSpoils(participants, totalSpoils);

            // Apply effects to winners and losers
            const winnerUpdates = applyGroupOutcomeEffect(
              participants,
              MILITARY_OUTCOMES.attackerWins,
              spoilsDistribution
            );
            const loserUpdates = applyGroupOutcomeEffect(
              targets,
              MILITARY_OUTCOMES.defenderLoses
            );

            // Add all updates to the transaction
            updates.push(
              ...winnerUpdates.map(update => 
                db.gameParticipant.update({
                  where: { id: update.participantId },
                  data: {
                    might: update.newMight,
                    economy: update.newEconomy,
                  },
                })
              ),
              ...loserUpdates.map(update =>
                db.gameParticipant.update({
                  where: { id: update.participantId },
                  data: {
                    might: update.newMight,
                    economy: update.newEconomy,
                  },
                })
              )
            );

            await updateGameLog(
              db,
              gameId,
              `Military action succeeded: ${participants.map(p => p.civilization).join(", ")} defeated ${targets.map(t => t.civilization).join(", ")}`,
              proposal.isPublic,
              proposal.isPublic ? [] : [...participants.map(p => p.id), ...targets.map(t => t.id)]
            );
          } else {
            // Attackers lose
            const attackerUpdates = applyGroupOutcomeEffect(
              participants,
              MILITARY_OUTCOMES.attackerLoses
            );
            const defenderUpdates = applyGroupOutcomeEffect(
              targets,
              MILITARY_OUTCOMES.defenderWins
            );

            updates.push(
              ...attackerUpdates.map(update =>
                db.gameParticipant.update({
                  where: { id: update.participantId },
                  data: {
                    might: update.newMight,
                    economy: update.newEconomy,
                  },
                })
              ),
              ...defenderUpdates.map(update =>
                db.gameParticipant.update({
                  where: { id: update.participantId },
                  data: {
                    might: update.newMight,
                    economy: update.newEconomy,
                  },
                })
              )
            );

            await updateGameLog(
              db,
              gameId,
              `Military action failed: ${targets.map(t => t.civilization).join(", ")} repelled ${participants.map(p => p.civilization).join(", ")}`,
              proposal.isPublic,
              proposal.isPublic ? [] : [...participants.map(p => p.id), ...targets.map(t => t.id)]
            );
          }
          break;
        }

        case "TRADE": {
          // Check who honored the trade agreement
          const honoredParticipants = participants.filter(participant =>
            proposal.votes.some(v => v.participant.id === participant.id && v.support)
          );
          const betrayers = participants.filter(participant =>
            !honoredParticipants.includes(participant)
          );

          // Apply appropriate outcomes
          if (honoredParticipants.length === participants.length) {
            // Everyone cooperated - use applyOutcomeEffect for individual benefits
            updates.push(
              ...participants.map(participant => {
                const outcome = applyOutcomeEffect(participant, TRADE_OUTCOMES.bothCooperate);
                return db.gameParticipant.update({
                  where: { id: participant.id },
                  data: {
                    might: outcome.newMight,
                    economy: outcome.newEconomy,
                    tradeDealsAccepted: {
                      increment: 1
                    }
                  },
                });
              })
            );
          } else if (honoredParticipants.length === 0) {
            // Everyone betrayed - use applyOutcomeEffect for individual penalties
            updates.push(
              ...participants.map(participant => {
                const outcome = applyOutcomeEffect(participant, TRADE_OUTCOMES.bothBetray);
                return db.gameParticipant.update({
                  where: { id: participant.id },
                  data: {
                    might: outcome.newMight,
                    economy: outcome.newEconomy,
                  },
                });
              })
            );
          } else {
            // Mixed outcome - use applyOutcomeEffect for individual effects
            updates.push(
              ...betrayers.map(betrayer => {
                const outcome = applyOutcomeEffect(betrayer, TRADE_OUTCOMES.betrayer);
                return db.gameParticipant.update({
                  where: { id: betrayer.id },
                  data: {
                    might: outcome.newMight,
                    economy: outcome.newEconomy,
                  },
                });
              }),
              ...honoredParticipants.map(honored => {
                const outcome = applyOutcomeEffect(honored, TRADE_OUTCOMES.betrayed);
                return db.gameParticipant.update({
                  where: { id: honored.id },
                  data: {
                    might: outcome.newMight,
                    economy: outcome.newEconomy,
                  },
                });
              })
            );
          }

          await updateGameLog(
            db,
            gameId,
            `Trade agreement completed between ${participants.map(p => p.civilization).join(", ")}`,
            proposal.isPublic,
            proposal.isPublic ? [] : participants.map(p => p.id)
          );
          break;
        }

        case "ALLIANCE": {
          // Use applyOutcomeEffect for individual alliance bonuses
          updates.push(
            ...participants.map(participant => {
              const outcome = applyOutcomeEffect(participant, ALLIANCE_OUTCOMES.formed);
              return db.gameParticipant.update({
                where: { id: participant.id },
                data: {
                  might: outcome.newMight,
                  economy: outcome.newEconomy,
                },
              });
            })
          );

          await updateGameLog(
            db,
            gameId,
            `Alliance formed between ${participants.map(p => p.civilization).join(", ")}`,
            proposal.isPublic,
            proposal.isPublic ? [] : participants.map(p => p.id)
          );
          break;
        }
      }

      // Execute all updates in a transaction
      if (updates.length > 0) {
        await db.$transaction(updates);
      }
    } else {
      // Log rejected proposal
      await updateGameLog(
        db,
        gameId,
        `${proposal.type} proposal by ${proposal.creator.civilization} was rejected`,
        proposal.isPublic,
        proposal.isPublic ? [] : [
          proposal.creator.id,
          ...proposal.participants.map(p => p.participant.id)
        ]
      );
    }
  }

  // After all proposals are resolved and stats are updated, evaluate objectives
  return evaluateObjectives(db, gameId, isGameEnd);
} 