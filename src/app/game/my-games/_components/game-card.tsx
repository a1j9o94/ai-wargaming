'use client';

import { useState } from "react";
import { useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import type { GamePhase } from "~/types/game";
import type { Game, GameParticipant, User } from "@prisma/client";
import { markGameAsCompleted } from "../actions";

type GameWithRelations = Game & {
  participants: (GameParticipant & {
    user: User | null;
  })[];
  _count: {
    proposals: number;
    discussions: number;
  };
};

export function GameCard({ game: initialGame }: { game: GameWithRelations }) {
  const [isPending, startTransition] = useTransition();
  const [game, setGame] = useState(initialGame);
  const humanPlayers = game.participants.filter((p) => !p.isAI);
  const currentPhase = game.phase as GamePhase;
  const isCompleted = currentPhase === "COMPLETED";

  const handleMarkAsCompleted = async () => {
    startTransition(async () => {
      await markGameAsCompleted(game.id);
      setGame({ ...game, phase: "COMPLETED" as GamePhase });
    });
  };

  return (
    <Card className="bg-black/40 hover:bg-black/60 transition-colors border-zinc-800">
      <div>
        <Link href={`/game/${game.id}`} className="block">
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
        {!isCompleted && (
          <CardContent className="pt-0">
            <form action={handleMarkAsCompleted}>
              <Button
                type="submit"
                variant="destructive"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Marking as Completed..." : "Mark as Completed"}
              </Button>
            </form>
          </CardContent>
        )}
      </div>
    </Card>
  );
} 