import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useState, type ChangeEvent } from "react";
import { type Participant, type OnSubmitProposalFunction } from "~/types/game";

interface ProposalDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: OnSubmitProposalFunction;
  opponents?: Participant[];
}

export function ProposalDialog({
  open,
  onClose,
  onSubmit,
  opponents = [],
}: ProposalDialogProps) {
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"TRADE" | "MILITARY" | "ALLIANCE">("TRADE");
  const [isPublic, setIsPublic] = useState(false);
  const [selectedOpponents, setSelectedOpponents] = useState<string[]>([]);

  const handleSubmit = async () => {
    await onSubmit({
      description,
      type,
      isPublic,
      recipients: selectedOpponents,
    });
    setDescription("");
    setType("TRADE");
    setIsPublic(false);
    setSelectedOpponents([]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#1a1b23] border border-white/10 text-white shadow-xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Make a Proposal</DialogTitle>
          <DialogDescription className="text-white/70">
            Create a new proposal to share with other players.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70">Type</Label>
            <Select
              value={type}
              onValueChange={(value: string) =>
                setType(value as "TRADE" | "MILITARY" | "ALLIANCE")
              }
            >
              <SelectTrigger className="bg-black/20 border-white/10 text-white">
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
              className="bg-black/20 border-white/10 text-white placeholder:text-white/50"
            />
          </div>

          <div>
            <Label className="text-white/70">Recipients</Label>
            <div className="space-y-2 mt-2">
              {opponents.map((opponent) => (
                <div key={opponent.id} className="flex items-center space-x-2">
                  <Switch
                    checked={selectedOpponents.includes(opponent.id)}
                    onCheckedChange={(checked: boolean) => {
                      setSelectedOpponents((prev) =>
                        checked
                          ? [...prev, opponent.id]
                          : prev.filter((id) => id !== opponent.id)
                      );
                    }}
                    className="data-[state=checked]:bg-[hsl(280,100%,70%)]"
                  />
                  <span className="text-white">{opponent.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={isPublic}
              onCheckedChange={(checked: boolean) => setIsPublic(checked)}
              className="data-[state=checked]:bg-[hsl(280,100%,70%)]"
            />
            <Label className="text-white">Make Public</Label>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white hover:text-white"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => void handleSubmit()}
              className="bg-[hsl(280,100%,70%)] hover:bg-[hsl(280,100%,65%)] text-white"
            >
              Submit
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 