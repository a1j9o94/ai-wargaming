'use client';

import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { type Opponent, type Discussion, type ChatMessage } from "~/types/game";

interface DiscussionDialogProps {
  open: boolean;
  onClose: () => void;
  opponents: Opponent[];
  currentDiscussion?: Discussion;
  onSendMessage: (content: string) => void;
  onUpdateParticipants: (participantIds: number[]) => void;
}

export function DiscussionDialog({ 
  open, 
  onClose, 
  opponents,
  currentDiscussion,
  onSendMessage,
  onUpdateParticipants
}: DiscussionDialogProps) {
  const [message, setMessage] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>(
    currentDiscussion?.participants || []
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentDiscussion?.messages]);

  // Update participants when selection changes
  useEffect(() => {
    onUpdateParticipants(selectedParticipants);
  }, [selectedParticipants, onUpdateParticipants]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const toggleParticipant = (opponentId: number) => {
    setSelectedParticipants(prev => 
      prev.includes(opponentId)
        ? prev.filter(id => id !== opponentId)
        : [...prev, opponentId]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="bg-[#0A0F1C] border-[#1E3A8A]/20 p-6 max-w-4xl w-full mx-4 h-[80vh] flex flex-col">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#60A5FA] mb-2">Diplomatic Discussion</h2>
            <div className="flex flex-wrap gap-2">
              {opponents.map(opponent => (
                <Button
                  key={opponent.id}
                  variant={selectedParticipants.includes(opponent.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleParticipant(opponent.id)}
                  className={selectedParticipants.includes(opponent.id)
                    ? "bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
                    : "bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
                  }
                >
                  {opponent.name}
                </Button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-[#1E3A8A]/10 border-[#1E3A8A]/30 hover:bg-[#1E3A8A]/20 text-[#60A5FA]"
          >
            Close Discussion
          </Button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 bg-[#1E3A8A]/5 p-4 rounded-lg">
          {currentDiscussion?.messages.map((msg, index) => {
            const sender = msg.senderId === 0 
              ? { name: "You" } 
              : opponents.find(o => o.id === msg.senderId);
            
            return (
              <div key={msg.id} className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[#60A5FA]">{sender?.name}</span>
                  <span className="text-xs text-gray-400">{msg.timestamp}</span>
                </div>
                <p className="text-gray-300 ml-4">{msg.content}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-[#1E3A8A]/10 border border-[#1E3A8A]/30 rounded-lg px-4 py-2 text-white placeholder:text-gray-400 focus:outline-none focus:border-[#60A5FA]"
          />
          <Button 
            type="submit"
            disabled={!message.trim()}
            className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[#F3F4F6]"
          >
            Send
          </Button>
        </form>
      </Card>
    </div>
  );
} 