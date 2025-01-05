import { Button } from "@/components/ui/button";
import type { GamePhase as GamePhaseType, Proposal, Participant } from "~/types/game";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Sword, TrendingUp, Loader2 } from "lucide-react";

interface PlayerAreaProps {
  phase: GamePhaseType;
  proposals: Proposal[];
  gameId: string;
  currentParticipantId: string;
  opponents: Participant[];
  remainingProposals: number;
  might: number;
  economy: number;
  onVote: (proposalId: string, support: boolean) => Promise<void>;
  onAdvancePhase: () => Promise<void>;
  onOpenDiscussion: (participantIds: string[]) => void;
  onOpenProposal: (recipientIds: string[]) => void;
}

interface AdvancePhaseButtonProps {
  onClick: () => Promise<void>;
  isLoading: boolean;
  variant?: "default" | "outline";
  children: React.ReactNode;
}

function AdvancePhaseButton({ onClick, isLoading, variant = "default", children }: AdvancePhaseButtonProps) {
  return (
    <Button 
      variant={variant}
      onClick={onClick}
      disabled={isLoading}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function PlayerArea({
  phase,
  proposals,
  gameId,
  currentParticipantId,
  opponents,
  remainingProposals,
  might,
  economy,
  onVote,
  onAdvancePhase,
  onOpenDiscussion,
  onOpenProposal,
}: PlayerAreaProps) {
  const [pendingMessages, setPendingMessages] = useState<string[]>([]);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Fetch objectives for the current participant
  const { data: objectives } = api.objectives.getParticipantObjectives.useQuery(
    {
      gameId,
      participantId: currentParticipantId,
    },
    {
      // Refetch objectives when game state changes
      refetchOnWindowFocus: true,
    }
  );

  api.events.onGameUpdate.useSubscription(
    { gameId },
    {
      onData(update) {
        if ('type' in update && update.type === 'CHAT' && 'event' in update) {
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

  const handleOpenGroupProposal = () => {
    // Open proposal with all opponents
    onOpenProposal(opponents.map(o => o.id));
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    await onVote(proposalId, support);
  };

  const handleAdvancePhase = async () => {
    setIsAdvancing(true);
    try {
      await onAdvancePhase();
    } finally {
      setIsAdvancing(false);
    }
  };

  const renderPhaseContent = () => {
    switch (phase) {
      case "SETUP":
        return (
          <div className="space-y-4">
            <p>Setup phase</p>
            <AdvancePhaseButton
              onClick={() => handleAdvancePhase()}
              isLoading={isAdvancing}
            >
              Advance Phase
            </AdvancePhaseButton>
          </div>
        );

      case "PROPOSAL":
        return (
          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button variant="outline" onClick={handleOpenGroupProposal}>
                Make Proposal
              </Button>
              <AdvancePhaseButton
                onClick={() => handleAdvancePhase()}
                isLoading={isAdvancing}
                variant="outline"
              >
                Pass
              </AdvancePhaseButton>
              <Button variant="outline" onClick={handleOpenGroupDiscussion}>
                Discuss
              </Button>
            </div>
          </div>
        );

      case "VOTING":
        const unvotedProposals = proposals.filter(
          (proposal) => {
            // Check if we haven't voted yet - look for existing votes in the proposal data
            const hasVoted = proposal.votes?.some(vote => vote.participantId === currentParticipantId);
            if (hasVoted) return false;
            
            // Check if we're a target (targets can't vote)
            const isTarget = proposal.participants.some((p) => 
              p.participantId === currentParticipantId && 
              p.role === "TARGET"
            );
            if (isTarget) return false;

            // Check if we're allowed to vote (must be creator or participant)
            const isAllowedToVote = proposal.participants.some(p => 
              p.participantId === currentParticipantId && 
              (p.role === "CREATOR" || p.role === "PARTICIPANT")
            );
            return isAllowedToVote;
          }
        );

        return (
          <div className="space-y-4">
            <div className="space-y-4">
              {unvotedProposals.length === 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground">No pending proposals to vote on.</p>
                  <AdvancePhaseButton
                    onClick={() => handleAdvancePhase()}
                    isLoading={isAdvancing}
                  >
                    Advance Phase
                  </AdvancePhaseButton>
                </div>
              ) : (
                unvotedProposals.map((proposal) => (
                  <div
                    key={proposal.id}
                    className="rounded-lg border bg-card p-4 space-y-2"
                  >
                    <p>{proposal.description}</p>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        onClick={() => void handleVote(proposal.id, true)}
                      >
                        Support
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => void handleVote(proposal.id, false)}
                      >
                        Oppose
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "RESOLVE":
        return (
          <div className="space-y-4">
            <AdvancePhaseButton
              onClick={() => handleAdvancePhase()}
              isLoading={isAdvancing}
            >
              Resolve Round
            </AdvancePhaseButton>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <p>Waiting for other players...</p>
            <AdvancePhaseButton
              onClick={() => handleAdvancePhase()}
              isLoading={isAdvancing}
            >
              Advance Phase
            </AdvancePhaseButton>
          </div>
        );
    }
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div className="space-y-6">
        {/* Status Section */}
        <div className="flex justify-between items-center pb-4 border-b">
          <span className="text-sm font-medium">Remaining Proposals</span>
          <span className="text-lg font-semibold">{remainingProposals}</span>
        </div>

        {/* Player Stats Section */}
        <div className="grid grid-cols-2 gap-4 pb-4 border-b">
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Military Might</span>
            <div className="flex items-center space-x-2">
              <Sword className="w-4 h-4 text-red-500" />
              <span className="text-lg font-semibold">{might}</span>
            </div>
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium text-muted-foreground">Economic Power</span>
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-lg font-semibold">{economy}</span>
            </div>
          </div>
        </div>
        
        {/* Objectives Section */}
        {objectives && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Objectives</h3>
            <div className="grid gap-4">
              {objectives.publicObjective && (
                <div className="rounded-lg border bg-card/50 p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium">Public Objective</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      objectives.publicObjective.status === 'COMPLETED' 
                        ? 'bg-green-500/10 text-green-500'
                        : objectives.publicObjective.status === 'FAILED'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {objectives.publicObjective.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{objectives.publicObjective.description}</p>
                  {(objectives.publicObjective.targetMight ?? objectives.publicObjective.targetEconomy) && (
                    <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                      {objectives.publicObjective.targetMight && (
                        <span>Target Might: {objectives.publicObjective.targetMight}</span>
                      )}
                      {objectives.publicObjective.targetEconomy && (
                        <span>Target Economy: {objectives.publicObjective.targetEconomy}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              {objectives.privateObjective && (
                <div className="rounded-lg border bg-card/50 p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium">Private Objective</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      objectives.privateObjective.status === 'COMPLETED' 
                        ? 'bg-green-500/10 text-green-500'
                        : objectives.privateObjective.status === 'FAILED'
                        ? 'bg-red-500/10 text-red-500'
                        : 'bg-blue-500/10 text-blue-500'
                    }`}>
                      {objectives.privateObjective.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{objectives.privateObjective.description}</p>
                  {(objectives.privateObjective.targetMight ?? objectives.privateObjective.targetEconomy) && (
                    <div className="flex gap-4 text-xs text-muted-foreground pt-1">
                      {objectives.privateObjective.targetMight && (
                        <span>Target Might: {objectives.privateObjective.targetMight}</span>
                      )}
                      {objectives.privateObjective.targetEconomy && (
                        <span>Target Economy: {objectives.privateObjective.targetEconomy}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Show pending messages */}
        {pendingMessages.map((msg, i) => (
          <div key={i} className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2">
            {msg}
          </div>
        ))}

        {/* Phase Content */}
        {renderPhaseContent()}
      </div>
    </div>
  );
} 