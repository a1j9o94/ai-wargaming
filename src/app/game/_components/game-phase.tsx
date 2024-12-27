import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type GameState, type Proposal } from "~/types/game";

interface GamePhaseProps {
  gameState: GameState;
  onMakeProposal: () => void;
  onStartDiscussion: () => void;
  onVote: (proposalId: number, support: boolean) => void;
  onPass: () => void;
  onResolveRound: () => void;
}

export function GamePhase({ 
  gameState, 
  onMakeProposal,
  onStartDiscussion,
  onVote, 
  onPass,
  onResolveRound 
}: GamePhaseProps) {
  const { currentRound, phase, remainingProposals } = gameState;

  // Helper to check if player has voted on a proposal
  const hasVotedOn = (proposal: Proposal) => {
    return proposal.votes.some(vote => vote.opponentId === 0); // 0 represents the player
  };

  // Get pending proposals that the player hasn't voted on yet
  const pendingProposals = gameState.proposals
    .filter(p => p.status === 'PENDING' && !hasVotedOn(p));

  return (
    <Card className="bg-[#0A0F1C]/80 border-[#1E3A8A]/20 p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-[#60A5FA]">Round {currentRound} of 10</h2>
          <p className="text-sm text-gray-400">Phase: {phase}</p>
        </div>
        <div className="flex items-center space-x-4">
          {phase === 'PROPOSAL' && (
            <>
              <div className="text-sm text-gray-400">
                Proposals Remaining: <span className="text-[#60A5FA]">{remainingProposals}</span>
              </div>
              <Button
                onClick={onStartDiscussion}
                variant="outline"
                className="bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
              >
                Have Discussion
              </Button>
              <Button
                onClick={onMakeProposal}
                disabled={remainingProposals === 0}
                className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
              >
                Make Proposal
              </Button>
              <Button
                onClick={onPass}
                variant="outline"
                className="bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
              >
                Pass
              </Button>
            </>
          )}
          {phase === 'VOTING' && (
            <div className="flex flex-col space-y-4 w-full">
              {pendingProposals.length > 0 ? (
                pendingProposals.map(proposal => (
                  <div key={proposal.id} className="flex items-center justify-between bg-[#1E3A8A]/10 p-4 rounded-lg">
                    <div className="flex-1">
                      <div className="text-[#60A5FA] font-semibold mb-1">
                        Proposal #{proposal.id}
                      </div>
                      <div className="text-sm text-gray-400">{proposal.description}</div>
                    </div>
                    <div className="flex space-x-2 ml-4">
                      <Button
                        onClick={() => onVote(proposal.id, true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Support
                      </Button>
                      <Button
                        onClick={() => onVote(proposal.id, false)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Oppose
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400">
                  All votes submitted - Moving to resolution phase...
                </div>
              )}
            </div>
          )}
          {phase === 'RESOLVE' && (
            <div className="flex flex-col items-center space-y-4 w-full">
              <div className="text-center">
                <h3 className="text-xl font-semibold text-[#60A5FA] mb-2">Round Resolution</h3>
                <p className="text-gray-400 mb-4">Review the outcomes and advance to the next round</p>
              </div>
              <Button
                onClick={onResolveRound}
                className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6] px-8"
              >
                Resolve Round
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Display current objectives */}
      <div className="grid grid-cols-2 gap-6 mt-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Public Objective</h3>
          <p className="text-[#60A5FA]">{gameState.playerObjectives.public.description}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2">Private Objective</h3>
          <p className="text-[#60A5FA]">{gameState.playerObjectives.private.description}</p>
        </div>
      </div>
    </Card>
  );
} 