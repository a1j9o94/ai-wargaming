import type { PrismaClient } from "@prisma/client";
import { GamePhase } from "~/types/game";
import { createProposal } from "~/server/api/routers/proposal";
import { createMessage } from "~/server/api/routers/discussion";
import { createVote } from "~/server/api/routers/proposal";

export async function handleAIPhaseActions(
  db: PrismaClient,
  gameId: string,
  phase: GamePhase,
  aiParticipantId: string
) {
  // Verify the participant is an AI
  const aiParticipant = await db.gameParticipant.findFirst({
    where: {
      id: aiParticipantId,
      gameId: gameId,
      isAI: true,
    },
    select: {
      id: true,
      civilization: true,
    },
  });

  if (!aiParticipant) {
    throw new Error('Invalid AI participant');
  }

  switch (phase) {
    case GamePhase.PROPOSAL:
      return handleProposalPhase(db, gameId, aiParticipant);
    case GamePhase.VOTING:
      return handleVotingPhase(db, gameId, aiParticipant);
  }
}

async function handleProposalPhase(
  db: PrismaClient,
  gameId: string,
  aiParticipant: { id: string; civilization: string }
) {
  // Random chance to make a proposal
  if (Math.random() > 0.5) {
    const otherParticipants = await db.gameParticipant.findMany({
      where: {
        gameId,
        id: { not: aiParticipant.id },
      },
    });

    // Determine proposal type with equal chance for each type
    const proposalType = Math.random() < 0.33 ? "TRADE" : 
                        Math.random() < 0.66 ? "MILITARY" : 
                        "ALLIANCE";
    
    if (proposalType === "MILITARY") {
      // Military proposal logic remains the same
      const shuffledParticipants = otherParticipants
        .sort(() => Math.random() - 0.5);
      
      const targets = [shuffledParticipants[0]!.id];
      shuffledParticipants.slice(1).forEach(p => {
        if (Math.random() > 0.7) targets.push(p.id);
      });

      const recipients = shuffledParticipants
        .filter(p => !targets.includes(p.id))
        .filter(() => Math.random() > 0.5)
        .map(p => p.id);

      if (recipients.length === 0) {
        return;
      }

      // Get recipient civilizations
      const recipientParticipants = await db.gameParticipant.findMany({
        where: {
          id: { in: recipients }
        },
        select: {
          civilization: true
        }
      });

      // Get target civilizations
      const targetParticipants = await db.gameParticipant.findMany({
        where: {
          id: { in: targets }
        },
        select: {
          civilization: true
        }
      });

      const recipientNames = recipientParticipants.map(p => p.civilization).join(", ");
      const targetNames = targetParticipants.map(p => p.civilization).join(", ");
      const proposalDescription = `${aiParticipant.civilization} proposes a military arrangement with ${recipientNames} against ${targetNames}`;

      return createProposal(db, {
        gameId,
        senderId: aiParticipant.id,
        participants: recipients,
        targets: targets,
        type: proposalType,
        description: proposalDescription,
        isPublic: Math.random() > 0.7,
      });
    } else if (proposalType === "ALLIANCE") {
      // For alliance proposals, select 1-3 participants randomly
      const shuffledParticipants = otherParticipants
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.floor(Math.random() * 3) + 1);
      
      const recipients = shuffledParticipants.map(p => p.id);
      
      // Get recipient civilizations
      const recipientParticipants = await db.gameParticipant.findMany({
        where: {
          id: { in: recipients }
        },
        select: {
          civilization: true
        }
      });

      const recipientNames = recipientParticipants.map(p => p.civilization).join(", ");
      const proposalDescription = `${aiParticipant.civilization} proposes forming an alliance with ${recipientNames}`;

      return createProposal(db, {
        gameId,
        senderId: aiParticipant.id,
        participants: recipients,
        targets: [],
        type: proposalType,
        description: proposalDescription,
        isPublic: Math.random() > 0.7,
      });
    } else {
      // Handle TRADE proposals (logic remains the same)
      const recipients = otherParticipants
        .filter(() => Math.random() > 0.5)
        .map(p => p.id);
      
      if (recipients.length === 0) {
        return;
      }

      // Get recipient civilizations
      const recipientParticipants = await db.gameParticipant.findMany({
        where: {
          id: { in: recipients }
        },
        select: {
          civilization: true
        }
      });

      const recipientNames = recipientParticipants.map(p => p.civilization).join(", ");
      const proposalDescription = `${aiParticipant.civilization} proposes a trade arrangement with ${recipientNames}`;

      return createProposal(db, {
        gameId,
        senderId: aiParticipant.id,
        participants: recipients,
        targets: [],
        type: proposalType,
        description: proposalDescription,
        isPublic: Math.random() > 0.7,
      });
    }
  }
}

async function handleVotingPhase(
  db: PrismaClient,
  gameId: string,
  aiParticipant: { id: string; civilization: string }
) {
  // Vote on all pending proposals
  const pendingProposals = await db.proposal.findMany({
    where: {
      gameId,
      status: "PENDING",
      // Don't vote on own proposals
      creatorId: { not: aiParticipant.id },
      // Haven't voted yet
      votes: {
        none: {
          participantId: aiParticipant.id
        }
      }
    },
  });

  console.log(`[AI-${aiParticipant.id}] Voting on ${pendingProposals.length} proposals`);
  
  for (const proposal of pendingProposals) {
    await createVote(db, {
      proposalId: proposal.id,
      participantId: aiParticipant.id,
      support: true,
    });
  }
}

function determineResponse(civilization: string, messageContent: string | null): string {
  if (!messageContent) {
    return `${civilization} acknowledges your message`;
  }

  const content = messageContent.toLowerCase();
  if (content.includes('trade')) {
    return `${civilization} expresses interest in trade negotiations`;
  } else if (content.includes('alliance')) {
    return `${civilization} considers your alliance proposal`;
  } else if (content.includes('attack') || content.includes('military')) {
    return `${civilization} takes note of your military intentions`;
  }
  
  return `${civilization} acknowledges your message`;
}

export async function handleAIMessageResponse(
  db: PrismaClient,
  discussionId: string,
  aiParticipantId: string
) {
  // Verify the participant is an AI
  const aiParticipant = await db.gameParticipant.findFirst({
    where: {
      id: aiParticipantId,
      isAI: true,
    },
    select: {
      id: true,
      civilization: true,
    },
  });

  if (!aiParticipant) {
    throw new Error('Invalid AI participant');
  }

  console.log(`[AI-${aiParticipant.id}] Responding to message`);
  
  // Get the last message in the discussion to potentially make the response more contextual
  const discussion = await db.discussion.findUnique({
    where: { id: discussionId },
    include: {
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { content: true }
      }
    }
  });

  if (!discussion) {
    throw new Error('Discussion not found');
  }

  const lastMessageContent = discussion.messages[0]?.content ?? null;
  const response = determineResponse(aiParticipant.civilization, lastMessageContent);
  
  return createMessage(db, {
    discussionId,
    senderId: aiParticipant.id,
    content: response,
  });
} 