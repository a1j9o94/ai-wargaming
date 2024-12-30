export const GamePhase = {
  SETUP: "SETUP",
  PROPOSAL: "PROPOSAL",
  DISCUSSION: "DISCUSSION",
  VOTING: "VOTING",
  RESOLVE: "RESOLVE",
  COMPLETED: "COMPLETED",
} as const;

export type GamePhase = typeof GamePhase[keyof typeof GamePhase];

export interface Participant {
  id: string;
  name: string;
  civilization: string;
  might: number;
  economy: number;
  isAI: boolean;
  userId: string | null;
  remainingProposals: number;
}

export interface LogEntry {
  time: string;
  event: string;
  isPublic?: boolean;
}

export interface Proposal {
  id: string;
  creatorId: string;
  roundNumber: number;
  description: string;
  type: "TRADE" | "MILITARY" | "ALLIANCE";
  isPublic: boolean;
  recipients: string[];
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  votes: Array<{
    opponentId: string;
    support: boolean;
  }>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
}

export interface Discussion {
  id: string;
  participants: string[];
  messages: ChatMessage[];
}

export interface GameState {
  id: string;
  currentRound: number;
  phase: GamePhase;
  playerObjectives: {
    public: string;
    private: string;
  };
  proposals: Proposal[];
  opponents: Participant[];
  discussions: Discussion[];
  log: LogEntry[];
  remainingProposals: number;
  winnerId?: string;
}

export type MakeProposalFunction = (data: {
  description: string;
  type: "TRADE" | "MILITARY" | "ALLIANCE";
  isPublic: boolean;
  recipients: string[];
}) => Promise<void>;

export type OnSubmitProposalFunction = (data: {
  description: string;
  type: "TRADE" | "MILITARY" | "ALLIANCE";
  isPublic: boolean;
  recipients: string[];
}) => Promise<void>;
