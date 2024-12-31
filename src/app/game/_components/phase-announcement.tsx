'use client';

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type GameState } from "~/types/game";

interface PhaseAnnouncementProps {
  show: boolean;
  onClose: () => void;
  round: number;
  phase: GameState['phase'];
}

export function PhaseAnnouncement({ show, onClose, round, phase }: PhaseAnnouncementProps) {
  if (!show) return null;

  const phaseDescriptions = {
    SETUP: "Game is being initialized",
    PROPOSAL: "Each player may make up to 2 proposals",
    DISCUSSION: "Players discuss the current proposals",
    VOTING: "Players vote on all active proposals",
    RESOLVE: "Resolving the outcomes of votes",
    COMPLETED: "Game has ended"
  } as const;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-[#0A0F1C] border-[#1E3A8A]/20 p-8 max-w-md w-full mx-4 animate-in fade-in slide-in-from-bottom-4">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-[#60A5FA]">Round {round}</h2>
          <h3 className="text-xl text-[#60A5FA]">{phase} Phase</h3>
          <p className="text-gray-400">{phaseDescriptions[phase]}</p>
          
          <Button 
            onClick={onClose}
            className="mt-6 bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
          >
            Continue
          </Button>
        </div>
      </Card>
    </div>
  );
} 