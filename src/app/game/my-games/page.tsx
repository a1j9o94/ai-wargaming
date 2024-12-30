import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/server";
import Link from "next/link";
import type { GamePhase } from "~/types/game";
import type { Game, GameParticipant, User } from "@prisma/client";

type GameWithRelations = Game & {
  participants: (GameParticipant & {
    user: User | null;
  })[];
  _count: {
    proposals: number;
    discussions: number;
  };
};

function GameCard({ game }: { game: GameWithRelations }) {
  const humanPlayers = game.participants.filter((p) => !p.isAI);
  const currentPhase = game.phase as GamePhase;
  const isCompleted = currentPhase === "COMPLETED";

  return (
    <Card className="bg-black/40 hover:bg-black/60 transition-colors border-zinc-800">
      <Link href={`/game/${game.id}`}>
        <CardHeader>
          <CardTitle className="text-lg text-white">
            Game #{game.id.slice(0, 8)}
          </CardTitle>
          <CardDescription className="text-zinc-400">
            {isCompleted ? (
              "Completed"
            ) : (
              `Round ${game.currentRound} • ${currentPhase.charAt(0) + currentPhase.slice(1).toLowerCase()} Phase`
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="text-sm text-zinc-400">
              {humanPlayers.length} Human Player{humanPlayers.length !== 1 ? "s" : ""}
            </div>
            <div className="flex gap-2 text-sm text-zinc-300">
              <div>{game._count.proposals} Proposals</div>
              <div>•</div>
              <div>{game._count.discussions} Discussions</div>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function GameCardSkeleton() {
  return (
    <Card className="bg-black/40 border-zinc-800">
      <CardHeader>
        <Skeleton className="h-6 w-[180px] bg-zinc-700/50" />
        <Skeleton className="h-4 w-[140px] mt-2 bg-zinc-700/50" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[100px] bg-zinc-700/50" />
          <Skeleton className="h-4 w-[160px] bg-zinc-700/50" />
        </div>
      </CardContent>
    </Card>
  );
}

async function GamesContent() {
  const [activeGames, completedGames] = await Promise.all([
    api.user.getActiveGames() as Promise<GameWithRelations[]>,
    api.user.getCompletedGames() as Promise<GameWithRelations[]>,
  ]);

  return (
    <div className="space-y-8">
      {/* Active Games Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-white">Active Games</h2>
          <Button 
            asChild
            className="bg-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,65%)]"
          >
            <Link href="/game/new">New Game</Link>
          </Button>
        </div>

        {activeGames.length === 0 ? (
          <div className="text-center py-8 text-white">
            <h3 className="text-lg font-medium">No Active Games</h3>
            <p className="text-zinc-400 mt-2">Start a new game to begin playing</p>
            <Button 
              asChild 
              className="mt-4 bg-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,65%)]"
            >
              <Link href="/game/new">Start New Game</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>

      {/* Completed Games Section */}
      <div>
        <h2 className="text-2xl font-semibold text-white mb-4">Completed Games</h2>
        {completedGames.length === 0 ? (
          <div className="text-center py-8 text-white">
            <h3 className="text-lg font-medium">No Completed Games</h3>
            <p className="text-zinc-400 mt-2">Your completed games will appear here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedGames.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyGamesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <div className="container py-8">
        <h1 className="text-3xl font-bold text-white mb-8">My Games</h1>
        
        <Suspense fallback={
          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold text-white">Active Games</h2>
                <Button 
                  asChild
                  className="bg-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,65%)]"
                >
                  <Link href="/game/new">New Game</Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white mb-4">Completed Games</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </div>
        }>
          <GamesContent />
        </Suspense>
      </div>
    </div>
  );
} 