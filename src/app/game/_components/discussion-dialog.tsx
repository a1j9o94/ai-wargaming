'use client';

import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Participant, ChatMessage } from "~/types/game";
import { api } from "~/trpc/react";

type ChatError = { type: 'error'; message: string };

interface DiscussionDialogProps {
  open: boolean;
  onClose: () => void;
  opponents: Participant[];
  currentParticipantId: string;
}

export function DiscussionDialog({
  open,
  onClose,
  opponents,
  currentParticipantId
}: DiscussionDialogProps) {
  const [message, setMessage] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessage = api.game.sendMessage.useMutation();

  // Filter out current player from opponents list
  const filteredOpponents = opponents.filter(opponent => opponent.id !== currentParticipantId);

  // Get game ID from URL safely
  const gameId = typeof window !== 'undefined' ? 
    window.location.pathname.split('/')[2] ?? '' : '';

  // Get or create discussion when participants change
  const { data: discussion, isLoading, refetch } = api.game.getDiscussion.useQuery(
    { 
      gameId,
      participantIds: [currentParticipantId, ...selectedParticipants].sort()
    },
    { 
      enabled: selectedParticipants.length >= 1 && gameId !== '',
      refetchOnWindowFocus: false,
    }
  );

  // Update messages when discussion changes
  useEffect(() => {
    if (!discussion || selectedParticipants.length === 0) {
      // Clear messages if no exact discussion exists or no participants selected
      setMessages([]);
    } else if (discussion.messages) {
      const newMessages: ChatMessage[] = discussion.messages.map(m => ({
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        timestamp: m.createdAt.toISOString()
      }));
      setMessages(newMessages);
    }
  }, [discussion, selectedParticipants]);

  // Subscribe to new messages
  api.game.onNewMessage.useSubscription(
    { discussionId: discussion?.id ?? '', lastEventId: null },
    {
      onData(data: unknown) {
        if (data && typeof data === 'object' && 'type' in data) {
          const error = data as ChatError;
          console.error('Chat subscription error:', error.message);
          return;
        }
        
        const chatMessage = data as ChatMessage;
        if (
          discussion?.id && // Ensure we have a current discussion
          chatMessage.id &&
          chatMessage.senderId &&
          chatMessage.content &&
          chatMessage.timestamp
        ) {
          setMessages(prev => [...prev, chatMessage]);
        }
      },
      enabled: Boolean(open && discussion?.id),
    }
  );

  // Debug logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Selected participants:', [currentParticipantId, ...selectedParticipants].sort());
      console.log('Current discussion:', discussion);
      console.log('Messages:', messages);
    }
  }, [selectedParticipants, discussion, messages, currentParticipantId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && discussion?.id) {
      await sendMessage.mutateAsync({
        discussionId: discussion.id,
        content: message,
        senderId: currentParticipantId
      });
      setMessage("");
    }
  };

  const toggleParticipant = (opponentId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(opponentId)
        ? prev.filter(id => id !== opponentId)
        : [...prev, opponentId]
    );
    // Clear current messages immediately while waiting for new data
    setMessages([]);
    // Force a re-fetch for immediate data
    setTimeout(() => void refetch(), 0);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0A0F1C] border-[#1E3A8A]/20 text-white max-w-4xl w-[90vw] h-[80vh] flex flex-col">
        <DialogTitle className="text-xl font-semibold text-[#60A5FA] mb-2">
          Diplomatic Discussion
        </DialogTitle>
        <DialogDescription className="text-gray-400 mb-4">
          Engage in diplomatic discussions with other players to form alliances and negotiate strategies.
        </DialogDescription>
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex flex-wrap gap-2">
              {filteredOpponents.map(opponent => (
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
        <div 
          key={discussion?.id ?? 'no-discussion'}
          className="flex-1 overflow-y-auto mb-4 space-y-4 bg-[#1E3A8A]/5 p-4 rounded-lg"
        >
          {selectedParticipants.length === 0 ? (
            <div className="text-center text-gray-400">Select participants to start a discussion</div>
          ) : isLoading ? (
            <div className="text-center text-gray-400">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-400">No messages yet. Start the conversation!</div>
          ) : messages.map((msg) => {
            const sender = msg.senderId === currentParticipantId
              ? { name: "You" }
              : opponents.find(o => o.id === msg.senderId);

            return (
              <div key={msg.id} className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-[#60A5FA]">{sender?.name ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-gray-300 ml-4">{msg.content}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-[#1E3A8A]/10 border-[#1E3A8A]/30 text-white placeholder:text-gray-400 focus:border-[#60A5FA]"
            disabled={selectedParticipants.length === 0}
          />
          <Button 
            type="submit"
            className="bg-[#1E3A8A] hover:bg-[#2B4C9F] text-[rgb(243,244,246)]"
            disabled={selectedParticipants.length === 0}
          >
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
} 