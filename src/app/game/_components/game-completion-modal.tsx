import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface GameCompletionModalProps {
  open: boolean;
  onClose: () => void;
  winner?: {
    civilization: string;
    isAI: boolean;
  };
  gameId: string;
}

export function GameCompletionModal({
  open,
  onClose,
  winner,
  gameId,
}: GameCompletionModalProps) {
  const router = useRouter();
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  useEffect(() => {
    setHasAcknowledged(false);
  }, [gameId, open]);

  if (!open || hasAcknowledged) return null;

  const handleClose = () => {
    setHasAcknowledged(true);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-[#0A0F1C] border-[#1E3A8A]/20 p-8 max-w-md w-full mx-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-[#60A5FA]">Game Over!</h2>
          <p className="text-gray-400">
            {winner ? (
              <span>
                {winner.civilization} has won the game!{" "}
                {winner.isAI ? "The AI emerges victorious!" : "Congratulations!"}
              </span>
            ) : (
              "The game has ended in a tie!"
            )}
          </p>
          
          <div className="flex justify-center gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                handleClose();
                router.push("/game/my-games");
              }}
              className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
            >
              Back to Active Games
            </Button>
            <Button
              onClick={() => {
                handleClose();
                setTimeout(() => {
                  const element = document.getElementById("game-log");
                  element?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
            >
              View Game Log
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
} 