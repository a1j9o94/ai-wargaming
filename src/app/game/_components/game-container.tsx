'use client';

import { useState, useEffect } from "react";
import { api } from "~/trpc/react";
import type { GamePhase, Discussion, ChatMessage, Participant } from "~/types/game";
import { GameLog } from "./game-log";
import { GamePhase as GamePhaseComponent } from "./game-phase";
import { OpponentGrid } from "./opponent-grid";
import { PhaseAnnouncement } from "./phase-announcement";
import { StatusPanel } from "./status-panel";
import { DiscussionDialog } from "./discussion-dialog";
import { ProposalDialog } from "./proposal-dialog";

interface GameContainerProps {
  gameId: string;
}

interface GameStateParticipant extends Participant {
  publicObjective: {
    type: string;
    status: string;
    description: string;
    isPublic: boolean;
    id: string;
    targetMight: number | null;
    targetEconomy: number | null;
    targetParticipantId: string | null;
    publicForId: string | null;
    privateForId: string | null;
  } | null;
  privateObjective: {
    type: string;
    status: string;
    description: string;
    isPublic: boolean;
    id: string;
    targetMight: number | null;
    targetEconomy: number | null;
    targetParticipantId: string | null;
    publicForId: string | null;
    privateForId: string | null;
  } | null;
}

interface GameStateDiscussion {
  id: string;
  participants: GameStateParticipant[];
  messages: ChatMessage[];
}

type ChatResponse = ChatMessage | { type: 'error'; message: string };

export function GameContainer({ gameId }: GameContainerProps) {
  // State hooks
  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [lastPhase, setLastPhase] = useState<GamePhase | null>(null);
  const [showDiscussionDialog, setShowDiscussionDialog] = useState(false);
  const [currentDiscussion, setCurrentDiscussion] = useState<Discussion | null>(null);
  const [showProposalDialog, setShowProposalDialog] = useState(false);
  const [proposalRecipients, setProposalRecipients] = useState<string[]>([]);

  // Get current participant first
  const { data: participant } = api.game.orchestrator.getCurrentParticipant.useQuery(
    { gameId }
  );

  // Query game state with participant ID
  const { data: gameState, refetch: refetchGameState } = api.game.orchestrator.getGameState.useQuery(
    { gameId, participantId: participant?.id ?? "" },
    { enabled: !!participant }
  );

  // Subscribe to game updates
  api.game.orchestrator.onGameUpdate.useSubscription(
    { gameId, lastEventId: null },
    {
      onData(update) {
        console.log("Game update:", update);
        void refetchGameState();
      },
    }
  );

  // Subscribe to chat messages if in a discussion
  api.game.discussion.onNewMessage.useSubscription(
    { discussionId: currentDiscussion?.id ?? "0", lastEventId: null },
    {
      onData(message: ChatResponse) {
        if (!currentDiscussion) return;
        console.log("New message:", message);
        if ('type' in message) return; // Skip error messages
        
        setCurrentDiscussion(prev => {
          if (!prev) return null;
          return {
            ...prev,
            messages: [...prev.messages, message],
          };
        });
      },
      enabled: currentDiscussion !== null,
    }
  );

  // Mutations
  const makeProposalMutation = api.game.proposal.makeProposal.useMutation({
    onSuccess: () => void refetchGameState(),
  });

  const voteMutation = api.game.proposal.vote.useMutation({
    onSuccess: () => void refetchGameState(),
  });

  const updateDiscussionMutation = api.game.discussion.updateDiscussionParticipants.useMutation({
    onSuccess: () => void refetchGameState(),
  });

  const advancePhaseMutation = api.game.orchestrator.advancePhase.useMutation({
    onSuccess: () => void refetchGameState(),
  });

  // Effects
  useEffect(() => {
    if (gameState?.phase && gameState.phase !== lastPhase) {
      setShowPhaseModal(true);
      setLastPhase(gameState.phase as GamePhase);
    }
  }, [gameState?.phase, lastPhase]);

  // Separate effect for discussion participants updates
  useEffect(() => {
    if (currentDiscussion && gameState) {
      const updatedDiscussion = gameState.discussions.find(d => d.id === currentDiscussion.id) as GameStateDiscussion | undefined;
      if (updatedDiscussion) {
        const currentParticipantIds = currentDiscussion.participants;
        const newParticipantIds = updatedDiscussion.participants.map(p => p.id);
        
        if (JSON.stringify(currentParticipantIds) !== JSON.stringify(newParticipantIds)) {
          setCurrentDiscussion(prev => ({
            ...prev!,
            participants: updatedDiscussion.participants.map(p => p.id),
          }));
        }
      }
    }
  }, [gameState, currentDiscussion]);

  if (!gameState || !participant) {
    return <div className="flex min-h-screen items-center justify-center text-white">
      <div className="animate-pulse text-lg">Loading game state...</div>
    </div>;
  }

  const currentParticipant = gameState.participants.find(
    (p) => p.id === participant.id
  );

  if (!currentParticipant) {
    return <div className="flex min-h-screen items-center justify-center text-white">
      <div className="rounded-lg bg-red-500/10 p-4 text-red-500">Error: You are not a participant in this game</div>
    </div>;
  }

  const handleMakeProposal = async (data: {
    description: string;
    type: "TRADE" | "MILITARY" | "ALLIANCE";
    isPublic: boolean;
    recipients: string[];
  }): Promise<void> => {
    if (!currentParticipant) return;
    await makeProposalMutation.mutateAsync({
      gameId,
      ...data,
      senderId: currentParticipant.id,
    });
  };

  const handleVote = async (proposalId: string, support: boolean): Promise<void> => {
    if (!currentParticipant) return;
    await voteMutation.mutateAsync({
      proposalId,
      support,
      participantId: currentParticipant.id,
    });
  };

  const handleAdvancePhase = async (): Promise<void> => {
    await advancePhaseMutation.mutateAsync({
      gameId,
    });
  };

  const handleOpenDiscussion = async (participantIds: string[]) => {
    if (currentDiscussion) {
      setCurrentDiscussion(null);
      setShowDiscussionDialog(false);
    }

    const sortedParticipantIds = [...participantIds].sort();

    const discussion = gameState?.discussions.find(d => {
      const discussionParticipantIds = d.participants.map(p => p.id).sort();
      return (
        discussionParticipantIds.length === sortedParticipantIds.length &&
        discussionParticipantIds.every((id, index) => id === sortedParticipantIds[index])
      );
    });

    if (discussion) {
      setCurrentDiscussion({
        id: discussion.id,
        participants: discussion.participants.map(p => p.id),
        messages: discussion.messages.map(m => ({
          id: m.id,
          senderId: m.senderId,
          content: m.content,
          timestamp: m.createdAt.toISOString(),
        })),
      });
      setShowDiscussionDialog(true);
    } else {
      try {
        const result = await updateDiscussionMutation.mutateAsync({
          discussionId: "-1",
          participantIds: sortedParticipantIds,
          gameId,
        });
        
        setCurrentDiscussion({
          id: result.id,
          participants: result.participants.map(p => p.id),
          messages: [],
        });
        setShowDiscussionDialog(true);
      } catch (error) {
        console.error('Error creating discussion:', error);
      }
    }
  };

  const handleCloseDiscussion = () => {
    setShowDiscussionDialog(false);
    setCurrentDiscussion(null);
  };

  const handleOpenProposal = (recipientIds: string[] = []) => {
    setProposalRecipients(recipientIds);
    setShowProposalDialog(true);
  };

  const handleCloseProposal = () => {
    setShowProposalDialog(false);
    setProposalRecipients([]);
  };

  return (
    <div className="container mx-auto min-h-screen p-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column - Status and Game Phase */}
        <div className="space-y-6">
          <StatusPanel
            currentRound={gameState.currentRound}
            phase={gameState.phase as GamePhase}
            remainingProposals={currentParticipant.remainingProposals}
          />
          <GamePhaseComponent
            gameId={gameId}
            phase={gameState.phase as GamePhase}
            currentParticipantId={currentParticipant.id}
            onVote={handleVote}
            onAdvancePhase={handleAdvancePhase}
            onOpenDiscussion={handleOpenDiscussion}
            onOpenProposal={handleOpenProposal}
            opponents={gameState.participants.filter(p => p.id !== currentParticipant.id).map(p => ({
              id: p.id,
              name: p.civilization,
              civilization: p.civilization,
              might: p.might,
              economy: p.economy,
              isAI: p.isAI,
              userId: p.userId,
              remainingProposals: p.remainingProposals
            }))}
            proposals={gameState.proposals.map(p => ({
              id: p.id,
              creatorId: p.creator.id,
              roundNumber: p.roundNumber,
              description: p.description,
              type: p.type as "TRADE" | "MILITARY" | "ALLIANCE",
              isPublic: p.isPublic,
              recipients: p.participants.map(part => part.participantId),
              status: p.status as "PENDING" | "ACCEPTED" | "REJECTED",
              votes: p.votes.map(v => ({
                opponentId: v.participantId,
                support: v.support,
              })),
            }))}
          />
        </div>

        {/* Middle column - Opponents */}
        <div className="lg:col-span-2">
          <OpponentGrid
            opponents={gameState.participants.filter(p => p.id !== currentParticipant.id).map(p => ({
              id: p.id,
              name: p.civilization,
              civilization: p.civilization,
              might: p.might,
              economy: p.economy,
              isAI: p.isAI,
              userId: p.userId,
              remainingProposals: p.remainingProposals
            }))}
            gameId={gameId}
            currentParticipantId={currentParticipant.id}
            onOpenDiscussion={handleOpenDiscussion}
            onOpenProposal={handleOpenProposal}
          />
        </div>
      </div>

      {/* Game Log */}
      <div className="mt-6">
        <GameLog 
          gameId={gameId}
          initialEntries={gameState.logEntries} 
        />
      </div>

      {/* Phase Announcement Modal */}
      <PhaseAnnouncement
        show={showPhaseModal}
        onClose={() => setShowPhaseModal(false)}
        phase={gameState.phase as GamePhase}
        round={gameState.currentRound}
      />

      {/* Discussion Dialog */}
      {showDiscussionDialog && currentDiscussion && (
        <DiscussionDialog
          open={showDiscussionDialog}
          onClose={handleCloseDiscussion}
          opponents={gameState.participants.filter(p => p.id !== currentParticipant.id).map(p => ({
            id: p.id,
            name: p.civilization,
            civilization: p.civilization,
            might: p.might,
            economy: p.economy,
            isAI: p.isAI,
            userId: p.userId,
            remainingProposals: p.remainingProposals
          }))}
          currentParticipantId={currentParticipant.id}
        />
      )}

      {/* Proposal Dialog */}
      <ProposalDialog
        open={showProposalDialog}
        onClose={handleCloseProposal}
        onSubmit={handleMakeProposal}
        opponents={gameState.participants.filter(p => p.id !== currentParticipant.id).map(p => ({
          id: p.id,
          name: p.civilization,
          civilization: p.civilization,
          might: p.might,
          economy: p.economy,
          isAI: p.isAI,
          userId: p.userId,
          remainingProposals: p.remainingProposals
        }))}
        currentParticipantId={currentParticipant.id}
        initialRecipients={proposalRecipients}
        remainingProposals={currentParticipant.remainingProposals}
      />
    </div>
  );
}