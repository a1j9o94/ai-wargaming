"use client";

import { api } from "~/trpc/react";
import { Button } from "@/components/ui/button";
import { AuthWrapper } from "./_components/auth-wrapper";
import { useRouter } from "next/navigation";

export default function GamePage() {
  const router = useRouter();

  // Create game mutation
  const createGameMutation = api.game.create.useMutation({
    onSuccess: (game) => {
      router.push(`/game/${game.id}`);
    },
  });

  const handleCreateGame = async () => {
    try {
      await createGameMutation.mutateAsync({
        civilization: "Earth Alliance", // TODO: Let user choose civilization
      });
    } catch (error) {
      if (error instanceof Error) {
        console.error("Failed to create game:", error.message);
      }
    }
  };

  return (
    <AuthWrapper>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            AI <span className="text-[hsl(280,100%,70%)]">Wargame</span>
          </h1>
          <div className="flex flex-col items-center gap-4">
            <p className="text-lg text-white/80">Start a new game to begin your conquest</p>
            <Button 
              onClick={() => void handleCreateGame()}
              disabled={createGameMutation.status === "pending"}
              className="text-lg"
            >
              {createGameMutation.status === "pending" ? "Creating..." : "Start New Game"}
            </Button>
          </div>
        </div>
      </main>
    </AuthWrapper>
  );
} 