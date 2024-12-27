import { OpponentCard } from "./opponent-card";
import { type Opponent } from "~/types/game";

interface OpponentGridProps {
  opponents: Opponent[];
  onDiscuss: (opponentId: number) => void;
  onPropose: (opponentId: number) => void;
}

export function OpponentGrid({ opponents, onDiscuss, onPropose }: OpponentGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
      {opponents.map((opponent) => (
        <OpponentCard 
          key={opponent.id} 
          opponent={opponent}
          onDiscuss={onDiscuss}
          onPropose={onPropose}
        />
      ))}
    </div>
  );
} 