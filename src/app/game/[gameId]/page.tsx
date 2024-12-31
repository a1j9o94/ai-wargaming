import { Button } from "~/components/ui/button";

export default function GamePage({ params }: { params: { gameId: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <div className="container mx-auto p-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Game #{params.gameId}</h1>
          <Button>
            Mark as Completed
          </Button>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-6">
          {/* Game content will go here */}
        </div>
      </div>
    </div>
  );
} 