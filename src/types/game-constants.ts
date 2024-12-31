export const PROPOSALS_PER_ROUND = 2;
export const NUMBER_OF_ROUNDS = 5;

export const ProposalRole = {
  CREATOR: "CREATOR",
  PARTICIPANT: "PARTICIPANT",
  TARGET: "TARGET",
} as const;

export type ProposalRole = typeof ProposalRole[keyof typeof ProposalRole]; 