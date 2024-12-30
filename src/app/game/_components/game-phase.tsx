import { Button } from "@/components/ui/button";
import type { GamePhase as GamePhaseType, Proposal, MakeProposalFunction, Participant } from "~/types/game";
import { ProposalDialog } from "./proposal-dialog";
import { useState } from "react";
import { api } from "~/trpc/react";

interface GamePhaseProps {
  phase: GamePhaseType;
  proposals: Proposal[];
  gameId: string;
  currentParticipantId: string;
  opponents: Participant[];
  onMakeProposal: MakeProposalFunction;
  onVote: (proposalId: string, support: boolean) => Promise<void>;
  onAdvancePhase: () => Promise<void>;
  onOpenDiscussion: (participantIds: string[]) => void;
}

export function GamePhase({
  phase,
  proposals,
  gameId,
  currentParticipantId,
  opponents,
  onMakeProposal,
  onVote,
  onAdvancePhase,
  onOpenDiscussion,
}: GamePhaseProps) {
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);

  api.game.orchestrator.onGameUpdate.useSubscription(
    { gameId },
    {
      onData(update) {
        if (update.type === 'CHAT') {
          setPendingMessages(prev => [...prev, String(update.event)]);
          // Clear message after 3 seconds
          setTimeout(() => {
            setPendingMessages(prev => prev.slice(1));
          }, 3000);
        }
      },
    }
  );

  const handleOpenGroupDiscussion = () => {
    // Open discussion with all opponents
    onOpenDiscussion([currentParticipantId, ...opponents.map(o => o.id)]);
  };

  const renderPhaseContent = () => {
    switch (phase) {
      case "PROPOSAL":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Proposal Phase</h3>
            <div className="flex space-x-4">
              <Button variant="outline" onClick={() => setIsProposalDialogOpen(true)}>
                Make Proposal
              </Button>
              <Button variant="outline" onClick={() => void onAdvancePhase()}>
                Pass
              </Button>
              <Button variant="outline" onClick={handleOpenGroupDiscussion}>
                Discuss
              </Button>
            </div>
          </div>
        );

      case "VOTING":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Voting Phase</h3>
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <div
                  key={proposal.id}
                  className="rounded-lg border bg-card p-4 space-y-2"
                >
                  <p>{proposal.description}</p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => void onVote(proposal.id, true)}
                    >
                      Support
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void onVote(proposal.id, false)}
                    >
                      Oppose
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case "RESOLVE":
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Resolve Phase</h3>
            <Button onClick={() => void onAdvancePhase()}>Resolve Round</Button>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">{phase} Phase</h3>
            <p>Waiting for other players...</p>
          </div>
        );
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      {/* Show pending messages */}
      {pendingMessages.map((msg, i) => (
        <div key={i} className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
          {msg}
        </div>
      ))}
      {renderPhaseContent()}
      <ProposalDialog
        open={isProposalDialogOpen}
        onClose={() => setIsProposalDialogOpen(false)}
        onSubmit={async (data) => {
          await onMakeProposal(data);
          setIsProposalDialogOpen(false);
        }}
      />
    </div>
  );
} 