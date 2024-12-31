import { Button } from "@/components/ui/button";
import type { GamePhase as GamePhaseType, Proposal, Participant } from "~/types/game";
import { useState } from "react";
import { api } from "~/trpc/react";
import { Sword, TrendingUp } from "lucide-react";

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
  const [votedProposals, setVotedProposals] = useState<Set<string>>(new Set());

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

  const handleOpenGroupProposal = () => {
    // Open proposal with all opponents
    onOpenProposal(opponents.map(o => o.id));
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    await onVote(proposalId, support);
    setVotedProposals(prev => new Set([...prev, proposalId]));
  };

  const renderPhaseContent = () => {
    switch (phase) {
      case "PROPOSAL":
        return (
          <div className="space-y-4">
            <div className="flex space-x-4">
              <Button variant="outline" onClick={handleOpenGroupProposal}>
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
        const unvotedProposals = proposals.filter(
          (proposal) => !votedProposals.has(proposal.id)
        );

        return (
          <div className="space-y-4">
            <div className="space-y-4">
              {unvotedProposals.length === 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground">No pending proposals to vote on.</p>
                  <Button onClick={() => void onAdvancePhase()}>Advance Phase</Button>
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
            <Button onClick={() => void onAdvancePhase()}>Resolve Round</Button>
          </div>
        );

      default:
        return (
          <div className="space-y-4">
            <p>Waiting for other players...</p>
            <Button onClick={() => void onAdvancePhase()}>Advance Phase</Button>
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