import type { GameParticipant } from "@prisma/client";

export type ObjectiveTarget = {
  type: "SELF" | "SPECIFIC_PLAYER" | "ANY_PLAYER" | "ALL_PLAYERS";
  field?: "might" | "economy";
  constraint?: "HIGHEST" | "LOWEST" | "ABOVE" | "BELOW";
  value?: number;
};

export type ObjectiveDefinition = {
  type: "TRADE_DEAL" | "MILITARY_ALLIANCE" | "SABOTAGE" | "ECONOMIC_GROWTH" | "MILITARY_GROWTH";
  description: (target?: GameParticipant) => string;
  isPublic: boolean;
  target: ObjectiveTarget;
};

// Public objectives are visible to all players
export const PUBLIC_OBJECTIVES: ObjectiveDefinition[] = [
  {
    type: "ECONOMIC_GROWTH",
    description: () => "Have the highest economy among all players",
    isPublic: true,
    target: {
      type: "SELF",
      field: "economy",
      constraint: "HIGHEST",
    },
  },
  {
    type: "MILITARY_GROWTH",
    description: () => "Have the highest might among all players",
    isPublic: true,
    target: {
      type: "SELF",
      field: "might",
      constraint: "HIGHEST",
    },
  },
];

// Private objectives are only visible to the assigned player
export const PRIVATE_OBJECTIVES: ObjectiveDefinition[] = [
  {
    type: "SABOTAGE",
    description: (target) => `Ensure ${target?.civilization} has the lowest economy`,
    isPublic: false,
    target: {
      type: "SPECIFIC_PLAYER",
      field: "economy",
      constraint: "LOWEST",
    },
  },
  {
    type: "SABOTAGE",
    description: (target) => `Ensure ${target?.civilization} has the lowest might`,
    isPublic: false,
    target: {
      type: "SPECIFIC_PLAYER",
      field: "might",
      constraint: "LOWEST",
    },
  },
]; 