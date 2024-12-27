import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Opponent } from "~/types/game";

interface ProposalDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (proposal: {
    description: string;
    type: 'TRADE' | 'MILITARY' | 'ALLIANCE';
    isPublic: boolean;
    recipients: number[];
  }) => void;
  opponents: Opponent[];
}

export function ProposalDialog({ open, onClose, onSubmit, opponents }: ProposalDialogProps) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<'TRADE' | 'MILITARY' | 'ALLIANCE'>('TRADE');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedOpponents, setSelectedOpponents] = useState<number[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      description,
      type,
      isPublic,
      recipients: selectedOpponents,
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0A0F1C] border-[#1E3A8A]/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-[#60A5FA]">New Proposal</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm text-gray-400">Type</label>
            <div className="flex space-x-2 mt-2">
              {(['TRADE', 'MILITARY', 'ALLIANCE'] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? 'default' : 'outline'}
                  onClick={() => setType(t)}
                  className={type === t 
                    ? "bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
                    : "bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
                  }
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Recipients</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {opponents.map((opponent) => (
                <Button
                  key={opponent.id}
                  type="button"
                  variant={selectedOpponents.includes(opponent.id) ? 'default' : 'outline'}
                  onClick={() => setSelectedOpponents(prev => 
                    prev.includes(opponent.id)
                      ? prev.filter(id => id !== opponent.id)
                      : [...prev, opponent.id]
                  )}
                  className={selectedOpponents.includes(opponent.id)
                    ? "bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
                    : "bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
                  }
                >
                  {opponent.name}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Visibility</label>
            <div className="flex space-x-2 mt-2">
              <Button
                type="button"
                variant={isPublic ? 'default' : 'outline'}
                onClick={() => setIsPublic(true)}
                className={isPublic
                  ? "bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
                  : "bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
                }
              >
                Public
              </Button>
              <Button
                type="button"
                variant={!isPublic ? 'default' : 'outline'}
                onClick={() => setIsPublic(false)}
                className={!isPublic
                  ? "bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
                  : "bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
                }
              >
                Private
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-2 p-2 rounded bg-[#1E3A8A]/10 border border-[#1E3A8A]/30 text-white"
              rows={4}
              placeholder="Describe your proposal..."
              required
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!description || selectedOpponents.length === 0}
              className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
            >
              Submit Proposal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
} 