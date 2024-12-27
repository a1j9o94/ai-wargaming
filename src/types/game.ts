export interface Opponent {
  id: number;
  name: string;
  avatar: string;
  status: string;
  might: number;
  economy: number;
}

export interface LogEntry {
  time: string;
  event: string;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  content: string;
  timestamp: string;
}

export interface Discussion {
  id: number;
  participants: number[]; // Array of participant IDs (including the player)
  messages: ChatMessage[];
}

export interface Objective {
  id: number;
  description: string;
  isPublic: boolean;
  targetMight?: number;
  targetEconomy?: number;
  targetOpponentId?: number;
  type: 'TRADE_DEAL' | 'MILITARY_ALLIANCE' | 'SABOTAGE' | 'ECONOMIC_GROWTH' | 'MILITARY_GROWTH';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export interface Proposal {
  id: number;
  createdById: number;
  roundNumber: number;
  description: string;
  type: 'TRADE' | 'MILITARY' | 'ALLIANCE';
  isPublic: boolean;
  recipients: number[]; // Array of opponent IDs
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  votes: {
    opponentId: number;
    support: boolean;
  }[];
}

export interface GameState {
  id: number;
  currentRound: number;
  phase: 'SETUP' | 'PROPOSAL' | 'DISCUSSION' | 'VOTING' | 'RESOLVE' | 'COMPLETED';
  playerObjectives: {
    public: Objective;
    private: Objective;
  };
  proposals: Proposal[];
  opponents: Opponent[];
  log: LogEntry[];
  remainingProposals: number;
  discussions: Discussion[]; // Track all discussions in the game
} 