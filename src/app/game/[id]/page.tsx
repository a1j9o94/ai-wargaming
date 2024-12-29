import { auth } from "~/server/auth";
import { redirect } from "next/navigation";
import { GameContainer } from "../_components/game-container";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function GamePage({ params }: PageProps) {
  // Server-side auth check
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const gameId = resolvedParams.id;

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <GameContainer gameId={gameId} />
    </main>
  );
} 