import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type LogEntry } from "~/types/game";

export function GameLog({ entries }: { entries: LogEntry[] }) {
  return (
    <Card className="col-span-2 bg-[#0A0F1C]/80 border-[#1E3A8A]/20 p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h2 className="text-xl font-semibold text-[#60A5FA]">Diplomatic Log</h2>
        <div className="flex items-center space-x-2">
          <div className="text-sm text-gray-400">Galactic Time:</div>
          <div className="font-mono text-[#60A5FA]">08:45:23</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        {entries.map((log, index) => (
          <div key={index} className="flex items-start space-x-3 p-3 rounded-lg bg-[#1E3A8A]/5 border border-[#1E3A8A]/10">
            <div className="text-sm font-mono text-[#60A5FA]/70">{log.time}</div>
            <div className="flex-1 text-gray-300">{log.event}</div>
          </div>
        ))}
      </div>
    </Card>
  );
} 