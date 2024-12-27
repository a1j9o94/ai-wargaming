import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { type GameState } from "~/types/game";
import { GameContainer } from "./_components/game-container";

export default async function GamePage() {
  // Server-side auth check
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // This will be replaced with real game state from the database
  const initialGameState: GameState = {
    id: 1,
    currentRound: 1,
    phase: 'PROPOSAL',
    remainingProposals: 2,
    playerObjectives: {
      public: {
        id: 1,
        description: "Establish a trade agreement with the Centauri Republic",
        isPublic: true,
        type: 'TRADE_DEAL',
        status: 'PENDING',
        targetOpponentId: 1
      },
      private: {
        id: 2,
        description: "Secretly undermine any military alliances proposed by the Sirius Confederation",
        isPublic: false,
        type: 'SABOTAGE',
        status: 'PENDING',
        targetOpponentId: 2
      }
    },
    opponents: [
      { id: 1, name: "Centauri Republic", avatar: "/avatars/centauri.jpg", status: "Active", might: 85, economy: 92 },
      { id: 2, name: "Sirius Confederation", avatar: "/avatars/sirius.jpg", status: "Active", might: 78, economy: 88 },
      { id: 3, name: "Proxima Alliance", avatar: "/avatars/proxima.jpg", status: "Active", might: 95, economy: 75 },
      { id: 4, name: "Vega Dominion", avatar: "/avatars/vega.jpg", status: "Active", might: 89, economy: 83 },
    ],
    proposals: [],
    log: [
      { time: "08:45:23", event: "Game started - Round 1 begins" },
      { time: "08:45:24", event: "Proposal phase - Each player may make up to 2 proposals" }
    ]
  };

  return <GameContainer initialGameState={initialGameState} />;
} 