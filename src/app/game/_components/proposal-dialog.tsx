import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, type ChangeEvent, useEffect } from "react";
import { type Participant, type OnSubmitProposalFunction } from "~/types/game";

interface ProposalDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: OnSubmitProposalFunction;
  opponents: Participant[];
  currentParticipantId: string;
  initialParticipants?: string[];
  initialTargets?: string[];
  remainingProposals?: number;
}

export function ProposalDialog({
  open,
  onClose,
  onSubmit,
  opponents,
  initialParticipants = [],
  initialTargets = [],
  remainingProposals = 0,
}: ProposalDialogProps) {

  const [description, setDescription] = useState("");
  const [type, setType] = useState<"TRADE" | "MILITARY" | "ALLIANCE">("TRADE");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dialog opens
  useEffect(() => {

    if (!open) {
      return;
    }

    // Use a single batch update
    const timer = setTimeout(() => {
      setDescription("");
      setType("TRADE");
      setIsPublic(false);
      setSelectedParticipants(initialParticipants);
      setSelectedTargets(initialTargets);
      setError(null);
    }, 0);

    return () => clearTimeout(timer);
  }, [open]); // Only depend on open state

  const handleSubmit = async () => {

    try {
      setError(null);
      await onSubmit({
        description,
        type,
        isPublic,
        participants: selectedParticipants,
        targets: selectedTargets,
      });
      onClose();
    } catch (err) {
      console.error('[ProposalDialog] Submit error:', err);
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const toggleParticipant = (opponentId: string) => {
    // Remove from targets if present
    if (selectedTargets.includes(opponentId)) {
      setSelectedTargets(prev => prev.filter(id => id !== opponentId));
    }
    setSelectedParticipants(prev => {
      const newParticipants = prev.includes(opponentId)
        ? prev.filter(id => id !== opponentId)
        : [...prev, opponentId];
      return newParticipants;
    });
  };

  const toggleTarget = (opponentId: string) => {
    // Remove from participants if present
    if (selectedParticipants.includes(opponentId)) {
      setSelectedParticipants(prev => prev.filter(id => id !== opponentId));
    }
    setSelectedTargets(prev => {
      const newTargets = prev.includes(opponentId)
        ? prev.filter(id => id !== opponentId)
        : [...prev, opponentId];
      return newTargets;
    });
  };

  const isDisabled = remainingProposals <= 0;

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <DialogContent 
        className="bg-[#1a1b23] border border-white/10 text-white shadow-xl"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Make a Proposal</DialogTitle>
          <DialogDescription className="text-white/70">
            Create a new proposal to share with other players.
          </DialogDescription>
          {remainingProposals !== undefined && (
            <p className="text-sm text-white/70 mt-1">
              Remaining proposals this round: <span className="font-semibold">{remainingProposals}</span>
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          {error && (
            <div className="text-red-400 bg-red-900/20 p-2 rounded-md text-sm">
              {error}
            </div>
          )}
          <div>
            <Label className="text-white/70">Type</Label>
            <Select
              value={type}
              onValueChange={(value: string) =>
                setType(value as "TRADE" | "MILITARY" | "ALLIANCE")
              }
              disabled={isDisabled}
            >
              <SelectTrigger className={`bg-black/20 border-white/10 text-white ${isDisabled ? 'opacity-50' : ''}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1b23] border-white/10 text-white">
                <SelectItem value="TRADE" className="hover:bg-white/10 focus:bg-white/10">Trade</SelectItem>
                <SelectItem value="MILITARY" className="hover:bg-white/10 focus:bg-white/10">Military</SelectItem>
                <SelectItem value="ALLIANCE" className="hover:bg-white/10 focus:bg-white/10">Alliance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-white/70">Description</Label>
            <Textarea
              value={description}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              placeholder="Describe your proposal..."
              className={`bg-black/20 border-white/10 text-white placeholder:text-white/50 ${isDisabled ? 'opacity-50' : ''}`}
              disabled={isDisabled}
            />
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-white/70 mb-2 block">Participants</Label>
              <div className="grid grid-cols-2 gap-2">
                {opponents.map((opponent) => (
                  <Button
                    key={`participant-${opponent.id}`}
                    variant="outline"
                    size="default"
                    onClick={() => toggleParticipant(opponent.id)}
                    disabled={isDisabled}
                    className={
                      selectedParticipants.includes(opponent.id)
                        ? "bg-[#9333EA] hover:bg-[#A855F7] border-[#9333EA] text-white disabled:opacity-50"
                        : "bg-[#1E293B] hover:bg-[#334155] border-[#334155] text-white disabled:opacity-50"
                    }
                  >
                    {opponent.name}
                  </Button>
                ))}
              </div>
            </div>

            {type === "MILITARY" && (
              <div>
                <Label className="text-white/70 mb-2 block">Targets</Label>
                <div className="grid grid-cols-2 gap-2">
                  {opponents.map((opponent) => (
                    <Button
                      key={`target-${opponent.id}`}
                      variant="outline"
                      size="default"
                      onClick={() => toggleTarget(opponent.id)}
                      disabled={isDisabled}
                      className={
                        selectedTargets.includes(opponent.id)
                          ? "bg-red-600 hover:bg-red-700 border-red-600 text-white disabled:opacity-50"
                          : "bg-[#1E293B] hover:bg-[#334155] border-[#334155] text-white disabled:opacity-50"
                      }
                    >
                      {opponent.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="default"
              onClick={() => setIsPublic(!isPublic)}
              disabled={isDisabled}
              className={
                isPublic
                  ? "bg-[#9333EA] hover:bg-[#A855F7] border-[#9333EA] text-white disabled:opacity-50"
                  : "bg-[#1E293B] hover:bg-[#334155] border-[#334155] text-white disabled:opacity-50"
              }
            >
              {isPublic ? 'Public Proposal' : 'Private Proposal'}
            </Button>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <DialogClose asChild>
              <Button 
                variant="outline" 
                onClick={onClose}
                className="bg-[#1E293B] hover:bg-[#334155] border-[#334155] text-white"
              >
                Cancel
              </Button>
            </DialogClose>
            <Button 
              onClick={() => void handleSubmit()}
              disabled={
                isDisabled || 
                description.trim() === '' || 
                selectedParticipants.length === 0 ||
                (type === "MILITARY" && selectedTargets.length === 0)
              }
              className="bg-[#9333EA] hover:bg-[#A855F7] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 