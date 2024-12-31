import { type Objective, type Game, type ChatMessage, type GameParticipant, type Proposal } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";

type ProposalForAI = Pick<Proposal, 'id' | 'type' | 'description' | 'isPublic'> & {
  creator: string;
  participants: string[];
  targets: string[];
};

export const proposalGenerationPrompt = (objectives: Objective[], game: Game, aiParticipant: GameParticipant, otherParticipants: GameParticipant[]) => {
    const proposal_outcomes = readFileSync(path.join(process.cwd(), 'src/types/proposal-outcomes.md'), 'utf8');
    
    return `You are playing a game where you represent a galactic civilization. You have the opportunity to make proposals to other players.
    Your civilization is ${aiParticipant.civilization}.
    Your objectives are ${objectives.map(o => o.description).join(", ")}.

    Current game state:
    - Your might: ${aiParticipant.might}
    - Your economy: ${aiParticipant.economy}
    - Current round: ${game.currentRound}
    - Game phase: ${game.phase}

    Other civilizations:
    ${otherParticipants.map(p => `- ${p.civilization} (Might: ${p.might}, Economy: ${p.economy})`).join("\n")}

    Proposal rules and outcomes:
    ${proposal_outcomes}

    Based on the game state and your objectives, generate between 0-2 proposals.
    Remember that proposals can fail and have consequences, so choose wisely.
    It's also valid to make no proposals if you don't see any good opportunities.`;
}

export const messageResponsePrompt = (objectives: Objective[], game: Game, participants: GameParticipant[], messages: ChatMessage[]) => {
    const proposal_outcomes = readFileSync(path.join(process.cwd(), 'src/types/proposal-outcomes.md'), 'utf8');
    
    return `You are playing a game where you represent a galactic civilization. Over the course of several rounds you have the opportunity to make proposals, vote on proposals, and engage in discussions with other players.
    It's important to remember that other players may lie or mislead you for their own benefit, you should be skeptical of their statements and make your own decisions based on the information you have. It is ok, and expected, that you can lie about your own actions and intentions.
    Your objectives are ${objectives.map(o => o.description).join(", ")}.
    Proposals can have the following outcomes:
    ${proposal_outcomes}

    You have the following context for the game:
    ${JSON.stringify(game)}

    You are responding to a discussion with the following participants:
    ${participants.map(p => `${p.id}: ${p.civilization}`).join(", ")}

    The conversation so far is:
    ${messages.map(m => `${m.senderId}: ${m.content}`).join("\n")}

    Use <thinking></thinking> tags to indicate your thoughts and <response></response> tags to indicate your response.`;
}

export const votingPrompt = (objectives: Objective[], game: Game, aiParticipant: GameParticipant, proposals: ProposalForAI[]) => {
    return `You are playing a game where you represent a galactic civilization. You need to vote on several proposals.
    Your civilization is ${aiParticipant.civilization}.
    Your objectives are ${objectives.map(o => o.description).join(", ")}.

    Current game state:
    - Your might: ${aiParticipant.might}
    - Your economy: ${aiParticipant.economy}
    - Current round: ${game.currentRound}
    - Game phase: ${game.phase}

    You need to vote on the following proposals:
    ${proposals.map((p) => `
    Proposal ID: ${p.id}
    - Type: ${p.type}
    - Description: ${p.description}
    - Creator: ${p.creator}
    - Public: ${p.isPublic}
    - Participants: ${p.participants.join(", ")}
    ${p.type === "MILITARY" ? `- Targets: ${p.targets.join(", ")}` : ""}
    `).join("\n")}

    For each proposal listed above, provide a vote using the exact Proposal ID shown.
    Vote true to support a proposal, false to oppose it.
    Provide a brief reasoning for each vote.
    
    Make sure to vote on ALL proposals listed above.`;
}