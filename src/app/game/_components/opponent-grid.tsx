import { OpponentCard } from "./opponent-card";
import { type Participant } from "~/types/game";

interface OpponentGridProps {
  opponents: Participant[];
  gameId: string;
  currentParticipantId: string;
  onMakeProposal: (data: {
    description: string;
    type: "TRADE" | "MILITARY" | "ALLIANCE";
    isPublic: boolean;
    recipients: string[];
  }) => Promise<void>;
  onOpenDiscussion: (participantIds: string[]) => void;
}

export function OpponentGrid({ 
  opponents, 
  currentParticipantId,
  onMakeProposal,
  onOpenDiscussion
}: OpponentGridProps) {
  const filteredOpponents = opponents.filter(opponent => opponent.id !== currentParticipantId);
  
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 flex-1 min-h-0">
      {filteredOpponents.map((opponent) => (
        <OpponentCard 
          key={opponent.id} 
          opponent={opponent}
          currentParticipantId={currentParticipantId}
          onMakeProposal={onMakeProposal}
          onOpenDiscussion={onOpenDiscussion}
        />
      ))}
    </div>
  );
} 