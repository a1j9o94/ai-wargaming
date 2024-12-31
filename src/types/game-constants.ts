export const PROPOSALS_PER_ROUND = 3;
export const NUMBER_OF_ROUNDS = 2;

export const ProposalRole = {
  CREATOR: "CREATOR",
  PARTICIPANT: "PARTICIPANT",
  TARGET: "TARGET",
} as const;

export type ProposalRole = typeof ProposalRole[keyof typeof ProposalRole]; 