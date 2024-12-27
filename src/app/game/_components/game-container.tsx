'use client';

import { useState, useEffect } from "react";
import { OpponentGrid } from "./opponent-grid";
import { StatusPanel } from "./status-panel";
import { GameLog } from "./game-log";
import { GamePhase } from "./game-phase";
import { ProposalDialog } from "./proposal-dialog";
import { DiscussionDialog } from "./discussion-dialog";
import { PhaseAnnouncement } from "./phase-announcement";
import { type GameState, type Discussion } from "~/types/game";

interface GameContainerProps {
  initialGameState: GameState;
}

const resolveOutcomes = (proposals: GameState['proposals']) => {
  // This is a placeholder for the actual resolution logic
  // Here we would determine the effects of each proposal based on votes
  const outcomes = proposals.map(proposal => {
    const supportCount = proposal.votes.filter(v => v.support).length;
    const opposedCount = proposal.votes.filter(v => !v.support).length;
    return {
      proposalId: proposal.id,
      accepted: supportCount > opposedCount,
      type: proposal.type,
      description: proposal.description
    };
  });

  return outcomes;
};

export function GameContainer({ initialGameState }: GameContainerProps) {
  const [gameState, setGameState] = useState<GameState>({
    ...initialGameState,
    discussions: [] // Initialize empty discussions array
  });
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [isDiscussionDialogOpen, setIsDiscussionDialogOpen] = useState(false);
  const [showPhaseAnnouncement, setShowPhaseAnnouncement] = useState(true);
  const [currentDiscussionId, setCurrentDiscussionId] = useState<number | null>(null);
  const [preselectedRecipients, setPreselectedRecipients] = useState<number[]>([]);

  // Track phase changes
  useEffect(() => {
    setShowPhaseAnnouncement(true);
  }, [gameState.phase, gameState.currentRound]);

  const handleStartDiscussion = () => {
    setIsDiscussionDialogOpen(true);
  };

  const getCurrentDiscussion = () => {
    return currentDiscussionId 
      ? gameState.discussions.find(d => d.id === currentDiscussionId)
      : undefined;
  };

  const handleUpdateParticipants = (participantIds: number[]) => {
    // Check if a discussion with these exact participants already exists
    const existingDiscussion = gameState.discussions.find(d => 
      d.participants.length === participantIds.length && 
      d.participants.every(p => participantIds.includes(p))
    );

    if (existingDiscussion) {
      setCurrentDiscussionId(existingDiscussion.id);
    } else if (participantIds.length > 0) {
      // Create a new discussion
      const newDiscussion: Discussion = {
        id: gameState.discussions.length + 1,
        participants: participantIds,
        messages: []
      };

      setGameState(prev => ({
        ...prev,
        discussions: [...prev.discussions, newDiscussion]
      }));
      setCurrentDiscussionId(newDiscussion.id);
    }
  };

  const handleSendMessage = (content: string) => {
    if (!currentDiscussionId) return;

    const message = {
      id: getCurrentDiscussion()?.messages.length ?? 0,
      senderId: 0, // Current player
      content,
      timestamp: new Date().toLocaleTimeString()
    };

    setGameState(prev => {
      const discussion = prev.discussions.find(d => d.id === currentDiscussionId);
      if (!discussion) return prev;

      const participantNames = discussion.participants
        .filter(id => id !== 0)
        .map(id => prev.opponents.find(o => o.id === id)?.name ?? 'Unknown')
        .join(", ");

      return {
        ...prev,
        discussions: prev.discussions.map(d => 
          d.id === currentDiscussionId
            ? { ...d, messages: [...d.messages, message] }
            : d
        ),
        log: [
          {
            time: message.timestamp,
            event: `You sent a message in discussion with ${participantNames}`
          },
          ...prev.log
        ]
      };
    });
  };

  const handleMakeProposal = () => {
    setIsProposalDialogOpen(true);
  };

  const handleProposalSubmit = (proposal: {
    description: string;
    type: 'TRADE' | 'MILITARY' | 'ALLIANCE';
    isPublic: boolean;
    recipients: number[];
  }) => {
    // Create a new proposal
    const newProposal = {
      id: gameState.proposals.length + 1,
      createdById: 0, // Current player
      roundNumber: gameState.currentRound,
      status: 'PENDING' as const,
      votes: [],
      ...proposal,
    };

    // Update game state
    setGameState(prev => ({
      ...prev,
      proposals: [...prev.proposals, newProposal],
      remainingProposals: prev.remainingProposals - 1,
      log: [
        {
          time: new Date().toLocaleTimeString(),
          event: `You made a ${proposal.isPublic ? 'public' : 'private'} ${proposal.type.toLowerCase()} proposal`
        },
        ...prev.log
      ]
    }));

    setIsProposalDialogOpen(false);
  };

  const checkAllVotesComplete = (proposals: GameState['proposals']) => {
    // For now, we'll assume each proposal needs one vote from each opponent plus the player
    const requiredVotesPerProposal = gameState.opponents.length + 1;
    return proposals.every(p => p.votes.length >= requiredVotesPerProposal);
  };

  const handleVote = (proposalId: number, support: boolean) => {
    setGameState(prev => {
      // Update the proposals with the new vote
      const updatedProposals = prev.proposals.map(p => 
        p.id === proposalId
          ? { ...p, votes: [...p.votes, { opponentId: 0, support }] }
          : p
      );

      // Check if player has voted on all proposals
      const hasVotedOnAll = updatedProposals.every(p => 
        p.votes.some(vote => vote.opponentId === 0)
      );

      if (hasVotedOnAll) {
        // Move to resolve phase
        return {
          ...prev,
          phase: 'RESOLVE',
          proposals: updatedProposals,
          log: [
            {
              time: new Date().toLocaleTimeString(),
              event: `You voted to ${support ? 'support' : 'oppose'} proposal #${proposalId}`
            },
            {
              time: new Date().toLocaleTimeString(),
              event: "All votes submitted - Moving to resolution phase"
            },
            ...prev.log
          ]
        };
      }

      // If not all votes are in, just update the proposals and log
      return {
        ...prev,
        proposals: updatedProposals,
        log: [
          {
            time: new Date().toLocaleTimeString(),
            event: `You voted to ${support ? 'support' : 'oppose'} proposal #${proposalId}`
          },
          ...prev.log
        ]
      };
    });
  };

  const handleResolveRound = () => {
    setGameState(prev => {
      // Resolve the outcomes
      const outcomes = resolveOutcomes(prev.proposals);
      
      // Create outcome messages
      const outcomeMessages = outcomes.map(outcome => ({
        time: new Date().toLocaleTimeString(),
        event: `Proposal ${outcome.description} was ${outcome.accepted ? 'accepted' : 'rejected'}`
      }));

      // Start new round
      return {
        ...prev,
        currentRound: prev.currentRound + 1,
        phase: 'PROPOSAL',
        remainingProposals: 2,
        proposals: [],
        log: [
          {
            time: new Date().toLocaleTimeString(),
            event: `Round ${prev.currentRound} completed - Starting Round ${prev.currentRound + 1}`
          },
          ...outcomeMessages,
          ...prev.log
        ]
      };
    });
  };

  const handlePass = () => {
    setGameState(prev => ({
      ...prev,
      phase: 'VOTING' as const,
      log: [
        {
          time: new Date().toLocaleTimeString(),
          event: "You passed your turn"
        },
        ...prev.log
      ]
    }));
  };

  return (
    <div className="h-[calc(100vh-4rem)]">
      <div className="h-full grid grid-cols-4 gap-4 p-4">
        {/* Game Phase Banner */}
        <div className="col-span-4">
          <GamePhase 
            gameState={gameState}
            onMakeProposal={handleMakeProposal}
            onStartDiscussion={handleStartDiscussion}
            onVote={handleVote}
            onPass={handlePass}
            onResolveRound={handleResolveRound}
          />
        </div>

        {/* Left Panel - Opponent Grid and Status */}
        <div className="col-span-2 flex flex-col space-y-4 h-full">
          <OpponentGrid 
            opponents={gameState.opponents}
            onDiscuss={(opponentId) => {
              setIsDiscussionDialogOpen(true);
              handleUpdateParticipants([opponentId]);
            }}
            onPropose={(opponentId) => {
              setIsProposalDialogOpen(true);
              // We'll pre-select this opponent in the proposal dialog
              setPreselectedRecipients([opponentId]);
            }}
          />
          <StatusPanel 
            name="Earth Alliance"
            title="High Commander"
            might={80}
            economy={75}
          />
        </div>

        {/* Right Panel - Game Log */}
        <GameLog entries={gameState.log} />
      </div>

      <ProposalDialog
        open={isProposalDialogOpen}
        onClose={() => {
          setIsProposalDialogOpen(false);
          setPreselectedRecipients([]);
        }}
        onSubmit={handleProposalSubmit}
        opponents={gameState.opponents}
        preselectedRecipients={preselectedRecipients}
      />

      <DiscussionDialog
        open={isDiscussionDialogOpen}
        onClose={() => {
          setIsDiscussionDialogOpen(false);
          setCurrentDiscussionId(null);
        }}
        opponents={gameState.opponents}
        currentDiscussion={getCurrentDiscussion()}
        onSendMessage={handleSendMessage}
        onUpdateParticipants={handleUpdateParticipants}
      />

      <PhaseAnnouncement
        show={showPhaseAnnouncement}
        onClose={() => setShowPhaseAnnouncement(false)}
        round={gameState.currentRound}
        phase={gameState.phase}
      />
    </div>
  );
} 