import type { GamePhase } from "~/types/game";

interface StatusPanelProps {
  currentRound: number;
  phase: GamePhase;
  remainingProposals: number;
}

export function StatusPanel({ currentRound, phase, remainingProposals }: StatusPanelProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-6 text-white shadow-lg">
      <h3 className="mb-4 text-xl font-bold tracking-tight">Game Status</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-white/70">Round</span>
          <span className="text-lg font-semibold text-[hsl(280,100%,70%)]">{currentRound}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/70">Phase</span>
          <span className="text-lg font-semibold text-[hsl(280,100%,70%)]">{phase}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-white/70">Remaining Proposals</span>
          <span className="text-lg font-semibold text-[hsl(280,100%,70%)]">{remainingProposals}</span>
        </div>
      </div>
    </div>
  );
} 