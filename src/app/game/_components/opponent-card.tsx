import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Participant } from "~/types/game";

interface OpponentCardProps {
  opponent: Participant & {
    publicObjective?: {
      type: string;
      status: string;
      description: string;
      isPublic: boolean;
      id: string;
      targetMight: number | null;
      targetEconomy: number | null;
      targetParticipantId: string | null;
      publicForId: string | null;
      privateForId: string | null;
    } | null;
  };
  currentParticipantId: string;
  onOpenDiscussion: (participantIds: string[]) => void;
  onOpenProposal: (recipientIds: string[]) => void;
}

export function OpponentCard({ 
  opponent,
  currentParticipantId,
  onOpenDiscussion,
  onOpenProposal
}: OpponentCardProps) {
  const handleOpenDiscussion = () => {
    onOpenDiscussion([currentParticipantId, opponent.id]);
  };

  const handleOpenProposal = () => {
    onOpenProposal([opponent.id]);
  };

  return (
    <Card className="relative overflow-hidden group flex flex-col border border-white/10 bg-black/20">
      <div className="absolute inset-0 bg-gradient-to-br from-[hsl(280,100%,70%)]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      
      {/* Status Indicator */}
      <div className="absolute top-2 right-2 z-10">
        <div className="h-2 w-2 rounded-full bg-[hsl(280,100%,70%)] animate-pulse" />
      </div>

      {/* Avatar and Info */}
      <div className="p-4 flex flex-col flex-1 relative z-10">
        <div className="aspect-video bg-white/5 rounded-lg mb-3 flex items-center justify-center">
          <div className="text-3xl text-white/30">{opponent.isAI ? '🤖' : '👤'}</div>
        </div>
        <h3 className="text-base font-bold text-white mb-2 truncate">{opponent.civilization}</h3>
        
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-white/70">Might:</span>
            <span className="font-semibold text-[hsl(280,100%,70%)]">{opponent.might}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-white/70">Econ:</span>
            <span className="font-semibold text-[hsl(280,100%,70%)]">{opponent.economy}</span>
          </div>
        </div>

        {/* Public Objective */}
        {opponent.publicObjective && (
          <div className="mb-3 p-2 rounded-lg border border-white/10 bg-white/5">
            <div className="flex justify-between items-start mb-1">
              <span className="text-xs font-medium text-white/70">Public Objective</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                opponent.publicObjective.status === 'COMPLETED' 
                  ? 'bg-green-500/10 text-green-500'
                  : opponent.publicObjective.status === 'FAILED'
                  ? 'bg-red-500/10 text-red-500'
                  : 'bg-blue-500/10 text-blue-500'
              }`}>
                {opponent.publicObjective.status}
              </span>
            </div>
            <p className="text-xs text-white/60">{opponent.publicObjective.description}</p>
            {(opponent.publicObjective.targetMight ?? opponent.publicObjective.targetEconomy) && (
              <div className="flex gap-2 text-xs text-white/50 mt-1">
                {opponent.publicObjective.targetMight && (
                  <span>Target Might: {opponent.publicObjective.targetMight}</span>
                )}
                {opponent.publicObjective.targetEconomy && (
                  <span>Target Economy: {opponent.publicObjective.targetEconomy}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex space-x-3 mt-auto">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenDiscussion}
            className="flex-1 h-8 px-3 text-sm bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white"
          >
            Discuss
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleOpenProposal}
            className="flex-1 h-8 px-3 text-sm bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white"
          >
            Propose
          </Button>
        </div>
      </div>
    </Card>
  );
} 