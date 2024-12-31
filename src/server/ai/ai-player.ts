import type { PrismaClient } from "@prisma/client";
import { GamePhase } from "~/types/game";
import { createProposal } from "~/server/api/routers/proposal";
import { createMessage } from "~/server/api/routers/discussion";
import { createVote } from "~/server/api/routers/proposal";
import { getGameContext } from "~/server/api/routers/orchestration-router";
import { readFileSync } from "fs";
import OpenAI from "openai";
import path from "path";

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

async function determineResponse(
  db: PrismaClient,
  discussionId: string,
  aiParticipantId: string
): Promise<string> {
    const discussion = await db.discussion.findUnique({
        where: { id: discussionId },
        include: {
            messages: true,
            participants: true,
        }
    });

    if (!discussion) {
        throw new Error('Discussion not found');
    }
  
    const aiParticipant = discussion.participants.find(p => p.id === aiParticipantId);

    if (!discussion || !aiParticipant) {
        throw new Error('AI participant not found');
    }

    const gameId = discussion.gameId;
  
    // gather game state
    const game = await getGameContext(db, gameId, aiParticipantId);

    //get the players objectives
    const objectives = await db.objective.findMany({
        where: {
            OR: [{ publicForId: aiParticipantId }, { privateForId: aiParticipantId }],
        },
    });

    const proposal_outcomes = readFileSync(path.join(process.cwd(), 'src/types/proposal-outcomes.md'), 'utf8');

    //write prompt for the AI to respond to the message with the game state for context
    const prompt = `
    You are playing a game where you represent a galactic civilization. Over the course of several rounds you have the opportunity to make proposals, vote on proposals, and engage in discussions with other players.
    It's important to remember that other players may lie or mislead you for their own benefit, you should be skeptical of their statements and make your own decisions based on the information you have. It is ok, and expected, that you can lie about your own actions and intentions.
    Your objectives are ${objectives.map(o => o.description).join(", ")}.
    Proposals can have the following outcomes:
     ${proposal_outcomes}

    You have the following context for the game:
    ${JSON.stringify(game)}

    You are responding to a discussion with the following participants:
    ${discussion.participants.map(p => p.id).join(", ")}

    The conversation so far is:
    ${discussion.messages.map(m => `${m.senderId}: ${m.content}`).join("\n")}

    Use <thinking></thinking> tags to indicate your thoughts and <response></response> tags to indicate your response.
    `;

    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    if (!openai) {
        throw new Error('Unable to connect to OpenAI');
    }

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
    });

    if (!response.choices[0]?.message?.content) {
        throw new Error('No response from OpenAI');
    }

    const rawResponse = response.choices[0].message.content;

    if (!rawResponse) {
        throw new Error('No response from OpenAI');
    }

    //get the message from between the <response></response> tags
    const responseRegex = /<response>(.*?)<\/response>/s;
    const message = responseRegex.exec(rawResponse)?.[1];

    if (!message) {
        throw new Error('Unable to parse response from OpenAI');
    }

    return message;
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

  const response = await determineResponse(db, discussionId, aiParticipant.id);
  
  return createMessage(db, {
    discussionId,
    senderId: aiParticipant.id,
    content: response,
  });
} 