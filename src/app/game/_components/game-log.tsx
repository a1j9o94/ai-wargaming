import { Card } from "@/components/ui/card";
import { type LogEntry } from "~/types/game";
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

export function GameLog({ gameId, initialEntries }: { gameId: string, initialEntries: LogEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);

  api.events.onGameUpdate.useSubscription(
    { gameId },
    {
      onData(update) {
        setEntries(prev => [...prev, update]);
      },
    }
  );

  // Update entries when initialEntries changes
  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  return (
    <Card className="flex flex-col h-[300px] border border-white/10 bg-black/20 text-white shadow-lg">
      <div className="flex justify-between items-center p-4 border-b border-white/10">
        <h2 className="text-lg font-bold tracking-tight">Diplomatic Log</h2>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-white/70">Galactic Time:</div>
          <div className="font-mono text-[hsl(280,100%,70%)]">08:45:23</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {entries.map((log, index) => (
          <div 
            key={index} 
            className="flex items-start space-x-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <div className="text-sm font-mono text-[hsl(280,100%,70%)]">{log.time}</div>
            <div className="flex-1 text-white/90">{log.event}</div>
          </div>
        ))}
      </div>
    </Card>
  );
} 