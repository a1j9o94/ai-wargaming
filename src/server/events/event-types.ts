export type GameUpdate = {
  type: 'GAME_UPDATE';
  event: string;
};

export type LogEntry = {
  id: string;
  isPublic?: boolean;
  visibleTo?: { id: string }[];
  event?: string;
  time?: string;
  createdAt?: Date;
};

export type GameEvent = GameUpdate | LogEntry; 