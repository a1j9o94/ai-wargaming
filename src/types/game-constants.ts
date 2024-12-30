export const PROPOSALS_PER_ROUND = 2;

export const ProposalRole = {
  CREATOR: "CREATOR",
  PARTICIPANT: "PARTICIPANT",
  TARGET: "TARGET",
} as const;

export type ProposalRole = typeof ProposalRole[keyof typeof ProposalRole]; 