import type { Proposal, ProposalParticipant } from "@prisma/client";
import { type PrismaClient } from "@prisma/client";
import { GamePhase } from "~/types/game";
import { ProposalRole } from "~/types/game-constants";
import { createProposal } from "~/server/api/routers/proposal";
import { createMessage, getDiscussion } from "~/server/api/routers/discussion";
import { createVote } from "~/server/api/routers/proposal";
import { getGameContext } from "~/server/api/routers/orchestration-router";
import OpenAI from "openai";
import { messageResponsePrompt, proposalGenerationPrompt, votingPrompt } from "./ai-prompts";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import { getVisibleObjectives } from "../api/routers/objectives";

const ProposalOutputSchema = z.object({
  proposals: z.array(z.object({
    type: z.enum(["TRADE", "MILITARY", "ALLIANCE"]),
    participants: z.array(z.string()),
    targets: z.array(z.string()),
    isPublic: z.boolean(),
    reasoning: z.string(),
    messageToParticipants: z.string()
  }))
});

const VotingOutputSchema = z.object({
  votes: z.array(z.object({
    proposalId: z.string(),
    support: z.boolean(),
    privateReasoning: z.string(),
    messageToParticipants: z.string()
  }))
});

type ProposalForAI = Pick<Proposal, 'id' | 'type' | 'description' | 'isPublic'> & {
  creator: string;
  participants: string[];
  targets: string[];
};

type ProposalWithRelations = Proposal & {
  creator: {
    civilization: string;
  };
  participants: (ProposalParticipant & {
    participant: {
      civilization: string;
      id: string;
    };
  })[];
  targets: (ProposalParticipant & {
    participant: {
      civilization: string;
    };
  })[];
};

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
  try {
    // Get full AI participant data
    const fullAiParticipant = await db.gameParticipant.findUnique({
      where: { id: aiParticipant.id },
    });

    if (!fullAiParticipant) {
      throw new Error('AI participant not found');
    }

    // Get other participants
    const otherParticipants = await db.gameParticipant.findMany({
      where: {
        gameId,
        id: { not: aiParticipant.id },
      },
    });

    // Get game context
    const game = await getGameContext(db, gameId, aiParticipant.id);

    if (!game) {
      throw new Error('Game not found');
    }

    // Get AI's objectives
    const objectives = await getVisibleObjectives(db, gameId, aiParticipant.id);

    // Generate the prompt and function schema
    const prompt = proposalGenerationPrompt(objectives, game, fullAiParticipant, otherParticipants);

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(ProposalOutputSchema, "proposals"),
    });

    const proposals = response.choices[0]?.message?.parsed;

    if (!proposals) {
      console.log('No proposals generated');
      return;
    }

    // Create each proposal
    for (const proposal of proposals.proposals) {
      // Get participant IDs from civilization names
      const participantIds = await db.gameParticipant.findMany({
        where: {
          gameId,
          civilization: { in: proposal.participants },
        },
        select: { id: true },
      });

      const targetIds = proposal.type === "MILITARY" ? await db.gameParticipant.findMany({
        where: {
          gameId,
          civilization: { in: proposal.targets },
        },
        select: { id: true },
      }) : [];

      await createProposal(db, {
        gameId,
        senderId: aiParticipant.id,
        participants: participantIds.map(p => p.id),
        targets: targetIds.map(t => t.id),
        type: proposal.type,
        description: `${aiParticipant.civilization} ${proposal.reasoning}`,
        isPublic: proposal.isPublic,
      });

      //get the discussion with the proposal participants
      const discussion = await getDiscussion(db, {
        gameId: gameId,
        participantIds: participantIds.map(p => p.id)
      });

      if (discussion) {
        await createMessage(db, {
          discussionId: discussion.id,
          senderId: aiParticipant.id,
          content: proposal.messageToParticipants,
        });
      }
    }
  } catch (error) {
    console.error('Error in handleProposalPhase:', error);
    throw error;
  }
}

async function handleVotingPhase(
  db: PrismaClient,
  gameId: string,
  aiParticipant: { id: string; civilization: string }
) {
  try {
    // Get full AI participant data
    const fullAiParticipant = await db.gameParticipant.findUnique({
      where: { id: aiParticipant.id },
    });

    if (!fullAiParticipant) {
      throw new Error('AI participant not found');
    }

    // Get pending proposals where the AI is a participant or creator and hasn't voted yet
    const pendingProposals = await db.proposal.findMany({
      where: {
        gameId,
        status: "PENDING",
        participants: {
          some: {
            participantId: aiParticipant.id,
            role: {
              in: [ProposalRole.CREATOR, ProposalRole.PARTICIPANT]
            }
          }
        },
        votes: {
          none: {
            participantId: aiParticipant.id
          }
        }
      },
      include: {
        creator: {
          select: {
            civilization: true
          }
        },
        participants: {
          include: {
            participant: {
              select: {
                civilization: true,
                id: true
              }
            }
          }
        },
        targets: {
          include: {
            participant: {
              select: {
                civilization: true
              }
            }
          }
        }
      }
    }) as ProposalWithRelations[];

    if (pendingProposals.length === 0) {
      return;
    }

    console.log(`[AI-${aiParticipant.id}] Voting on ${pendingProposals.length} proposals`);

    // Get game context
    const game = await getGameContext(db, gameId, aiParticipant.id);

    if (!game) {
      throw new Error('Game not found');
    }

    // Get AI's objectives
    const objectives = await getVisibleObjectives(db, gameId, aiParticipant.id);

    // Format proposals for the prompt
    const proposalsForAI: ProposalForAI[] = pendingProposals.map(p => ({
      id: p.id,
      type: p.type,
      description: p.description,
      creator: p.creator.civilization,
      isPublic: p.isPublic,
      participants: p.participants.map(part => part.participant.civilization),
      targets: p.targets.map(target => target.participant.civilization)
    }));

    // Generate the prompt
    const prompt = votingPrompt(objectives, game, fullAiParticipant, proposalsForAI);

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      response_format: zodResponseFormat(VotingOutputSchema, "votes"),
    });

    const votes = response.choices[0]?.message?.parsed;

    if (!votes) {
      console.log('No votes generated');
      return;
    }

    // Create each vote
    for (const vote of votes.votes) {
      console.log(`[AI-${aiParticipant.id}] Processing vote:`, {
        proposalId: vote.proposalId,
        support: vote.support,
        privateReasoning: vote.privateReasoning,
        messageToParticipants: vote.messageToParticipants
      });

      // Validate that the proposal exists in our pending proposals
      const proposal = pendingProposals.find(p => p.id === vote.proposalId);
      if (!proposal) {
        console.error(`[AI-${aiParticipant.id}] Proposal ${vote.proposalId} not found in pending proposals:`, {
          availableProposals: pendingProposals.map(p => p.id)
        });
        continue; // Skip this vote and continue with others
      }

      await createVote(db, {
        proposalId: vote.proposalId,
        participantId: aiParticipant.id,
        support: vote.support,
      });

      // Get participant IDs for the discussion
      const participantIds = proposal.participants.map(p => p.participant.id);

      // Get the discussion with the proposal participants
      const discussion = await getDiscussion(db, {
        gameId: gameId,
        participantIds: participantIds
      });

      console.log(`[AI-${aiParticipant.id}] Voting on proposal ${proposal.id} with discussion ${discussion?.id} and reasoning: ${vote.privateReasoning}`);

      if (discussion) {
        await createMessage(db, {
          discussionId: discussion.id,
          senderId: aiParticipant.id,
          content: vote.messageToParticipants,
        });
      }
    }
  } catch (error) {
    console.error('Error in handleVotingPhase:', error);
    throw error;
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

    if (!game) {
        throw new Error('Game not found');
    }

    //get the players objectives
    const objectives = await getVisibleObjectives(db, gameId, aiParticipantId);

    //write prompt for the AI to respond to the message with the game state for context
    const prompt = messageResponsePrompt(objectives, game, discussion.participants, discussion.messages);

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