import type { GameParticipant } from "@prisma/client";

export type OutcomeEffect = {
  mightChange: number | ((participant: GameParticipant) => number);
  economyChange: number | ((participant: GameParticipant) => number);
};

export type MilitaryOutcome = {
  attackerWins: OutcomeEffect;
  attackerLoses: OutcomeEffect;
  defenderWins: OutcomeEffect;
  defenderLoses: OutcomeEffect;
  attackCost: number;
};

export type TradeOutcome = {
  bothCooperate: OutcomeEffect;
  betrayer: OutcomeEffect;
  betrayed: OutcomeEffect;
  bothBetray: OutcomeEffect;
};

export type AllianceOutcome = {
  formed: OutcomeEffect;
  broken: OutcomeEffect;
};

// Military action outcomes - based on might comparison
export const MILITARY_OUTCOMES: MilitaryOutcome = {
  attackerWins: {
    mightChange: (attacker) => Math.floor(attacker.might * 0.5), // 50% might increase
    economyChange: (attacker) => Math.floor(attacker.economy * 0.3), // Gain 30% of economy as spoils
  },
  attackerLoses: {
    mightChange: (attacker) => -Math.floor(attacker.might * 0.4), // Lose 40% might
    economyChange: -20, // Fixed economy loss
  },
  defenderWins: {
    mightChange: (defender) => Math.floor(defender.might * 0.3), // 30% might increase
    economyChange: 10, // Small economy gain
  },
  defenderLoses: {
    mightChange: (defender) => -Math.floor(defender.might * 0.6), // Lose 60% might
    economyChange: (defender) => -Math.floor(defender.economy * 0.4), // Lose 40% economy
  },
  attackCost: 30, // Base cost to initiate an attack
};

// Trade outcomes - prisoner's dilemma style
export const TRADE_OUTCOMES: TradeOutcome = {
  bothCooperate: {
    mightChange: 0,
    economyChange: (participant) => Math.floor(participant.economy * 0.2), // Both gain 20%
  },
  betrayer: {
    mightChange: 0,
    economyChange: (participant) => Math.floor(participant.economy * 0.3), // Gain 30%
  },
  betrayed: {
    mightChange: 0,
    economyChange: (participant) => -Math.floor(participant.economy * 0.1), // Lose 10%
  },
  bothBetray: {
    mightChange: 0,
    economyChange: -10, // Small fixed loss
  },
};

// Alliance outcomes
export const ALLIANCE_OUTCOMES: AllianceOutcome = {
  formed: {
    mightChange: (participant) => Math.floor(participant.might * 0.15), // 15% might increase
    economyChange: (participant) => Math.floor(participant.economy * 0.15), // 15% economy increase
  },
  broken: {
    mightChange: -10,
    economyChange: -10,
  },
};

export type CombatGroup = {
  participants: GameParticipant[];
  isAttacking: boolean; // true for attackers, false for defenders
};

// Helper function to calculate total might for a group
function calculateGroupMight(group: CombatGroup): number {
  return group.participants.reduce((total, participant) => {
    // Attackers pay an efficiency penalty for coordination
    const efficiency = group.isAttacking ? 0.9 : 1;
    return total + (participant.might * efficiency);
  }, 0);
}

// Helper function to calculate military victory for groups
export function calculateMilitaryOutcome(
  attackers: GameParticipant[],
  defenders: GameParticipant[],
  defendersAttacking: boolean
): boolean {
  // If defenders aren't attacking back, they automatically lose
  if (!defendersAttacking) {
    return true;
  }

  const attackingGroup: CombatGroup = { participants: attackers, isAttacking: true };
  const defendingGroup: CombatGroup = { participants: defenders, isAttacking: false };

  const totalAttackingMight = calculateGroupMight(attackingGroup);
  const totalDefendingMight = calculateGroupMight(defendingGroup);

  // Base chance from combined might comparison
  const mightDifference = totalAttackingMight - totalDefendingMight;
  const baseChance = 0.5 + (mightDifference / (200 * Math.max(attackers.length, defenders.length))); 
  // Scale the might difference by group size to prevent overwhelming advantages

  // Add some randomness
  const random = Math.random();
  
  // Return true if attackers win
  return random < baseChance;
}

// Helper function to distribute spoils among winners
export function distributeSpoils(
  winners: GameParticipant[],
  totalSpoils: number
): number[] {
  // Distribute spoils proportionally to might
  const totalMight = winners.reduce((sum, p) => sum + p.might, 0);
  return winners.map(winner => 
    Math.floor((winner.might / totalMight) * totalSpoils)
  );
}

// Helper function to apply outcome effect to a group
export function applyGroupOutcomeEffect(
  participants: GameParticipant[],
  effect: OutcomeEffect,
  spoilsDistribution?: number[]
): Array<{ participantId: string; newMight: number; newEconomy: number }> {
  return participants.map((participant, index) => {
    const mightChange = typeof effect.mightChange === 'function' 
      ? effect.mightChange(participant)
      : effect.mightChange;

    let economyChange = typeof effect.economyChange === 'function'
      ? effect.economyChange(participant)
      : effect.economyChange;

    // Add spoils if provided
    if (spoilsDistribution?.[index]) {
      economyChange += spoilsDistribution[index];
    }

    // Ensure values stay within reasonable bounds (1-100)
    const newMight = Math.max(1, Math.min(100, participant.might + mightChange));
    const newEconomy = Math.max(1, Math.min(100, participant.economy + economyChange));

    return {
      participantId: participant.id,
      newMight,
      newEconomy,
    };
  });
}

// Keep the existing applyOutcomeEffect for non-military proposals
export function applyOutcomeEffect(
  participant: GameParticipant,
  effect: OutcomeEffect
): { newMight: number; newEconomy: number } {
  const mightChange = typeof effect.mightChange === 'function' 
    ? effect.mightChange(participant)
    : effect.mightChange;

  const economyChange = typeof effect.economyChange === 'function'
    ? effect.economyChange(participant)
    : effect.economyChange;

  // Ensure values stay within reasonable bounds (1-100)
  const newMight = Math.max(1, Math.min(100, participant.might + mightChange));
  const newEconomy = Math.max(1, Math.min(100, participant.economy + economyChange));

  return { newMight, newEconomy };
} 