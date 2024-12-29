import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Participant, type MakeProposalFunction } from "~/types/game";
import { useState } from "react";
import { ProposalDialog } from "./proposal-dialog";

interface OpponentCardProps {
  opponent: Participant;
  currentParticipantId: string;
  onMakeProposal: MakeProposalFunction;
  onOpenDiscussion: (participantIds: string[]) => void;
}

export function OpponentCard({ 
  opponent,
  currentParticipantId,
  onMakeProposal,
  onOpenDiscussion
}: OpponentCardProps) {
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);

  const handleOpenDiscussion = () => {
    onOpenDiscussion([currentParticipantId, opponent.id]);
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
            onClick={() => setIsProposalDialogOpen(true)}
            className="flex-1 h-8 px-3 text-sm bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white"
          >
            Propose
          </Button>
        </div>
      </div>

      <ProposalDialog
        open={isProposalDialogOpen}
        onClose={() => setIsProposalDialogOpen(false)}
        onSubmit={async (data) => {
          await onMakeProposal({
            ...data,
            recipients: [opponent.id]
          });
          setIsProposalDialogOpen(false);
        }}
      />
    </Card>
  );
} 