import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Opponent } from "~/types/game";

interface OpponentCardProps {
  opponent: Opponent;
  onDiscuss: (opponentId: number) => void;
  onPropose: (opponentId: number) => void;
}

export function OpponentCard({ opponent, onDiscuss, onPropose }: OpponentCardProps) {
  return (
    <Card className="relative bg-[#0A0F1C]/80 border-[#1E3A8A]/20 overflow-hidden group flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A8A]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Status Indicator */}
      <div className="absolute top-2 right-2 z-10">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      </div>

      {/* Avatar and Info */}
      <div className="p-3 flex flex-col flex-1 relative z-10">
        <div className="aspect-video bg-[#1E3A8A]/20 rounded-lg mb-2 flex items-center justify-center">
          <div className="text-3xl text-[#60A5FA]/30">👤</div>
        </div>
        <h3 className="text-base font-semibold text-[#60A5FA] mb-1 truncate">{opponent.name}</h3>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Might:</span>
            <span className="text-[#60A5FA]">{opponent.might}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-gray-400">Econ:</span>
            <span className="text-[#60A5FA]">{opponent.economy}</span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2 mt-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onDiscuss(opponent.id)}
            className="flex-1 h-7 px-2 text-xs bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA] hover:text-[#60A5FA]"
          >
            Discuss
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onPropose(opponent.id)}
            className="flex-1 h-7 px-2 text-xs bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA] hover:text-[#60A5FA]"
          >
            Propose
          </Button>
        </div>
      </div>
    </Card>
  );
} 