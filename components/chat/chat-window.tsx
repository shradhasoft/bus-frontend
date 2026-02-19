"use client";

import React from "react";
import { X, Minimize2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ChatInput from "./chat-input";
import MessageList from "./message-list";
import { useChat } from "@/hooks/use-chat";

interface ChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatWindow = ({ isOpen, onClose }: ChatWindowProps) => {
  const { messages, sendMessage, isLoading, resetChat } = useChat();

  if (!isOpen) return null;

  return (
    <Card className="flex flex-col w-[350px] sm:w-[400px] h-[500px] sm:h-[600px] shadow-2xl border-border overflow-hidden bg-background/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-primary text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-400 absolute bottom-0 right-0 ring-2 ring-primary"></div>
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              🤖
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-sm">Bus Assistant</h3>
            <p className="text-xs text-primary-foreground/80">Online</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={resetChat}
            title="Reset Chat"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={onClose}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-muted/50">
        <MessageList
          messages={messages}
          isLoading={isLoading}
          onActionClick={sendMessage}
        />
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </Card>
  );
};

export default ChatWindow;
