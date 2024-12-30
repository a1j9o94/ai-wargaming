import { OpponentCard } from "./opponent-card";
import type { Participant } from "~/types/game";

interface OpponentGridProps {
  opponents: Participant[];
  gameId: string;
  currentParticipantId: string;
  onOpenDiscussion: (participantIds: string[]) => void;
  onOpenProposal: (recipientIds: string[]) => void;
}

export function OpponentGrid({
  opponents,
  currentParticipantId,
  onOpenDiscussion,
  onOpenProposal,
}: OpponentGridProps) {

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {opponents.map((opponent) => (
        <OpponentCard
          key={opponent.id}
          opponent={opponent}
          currentParticipantId={currentParticipantId}
          onOpenDiscussion={onOpenDiscussion}
          onOpenProposal={onOpenProposal}
        />
      ))}
    </div>
  );
} 