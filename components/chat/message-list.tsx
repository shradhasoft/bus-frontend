"use client";

import React, { useEffect, useRef } from "react";
import ChatMessage, { Message } from "./chat-message";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  messages: Message[];
  isLoading?: boolean;
  onActionClick?: (action: string) => void;
}

const MessageList = ({
  messages,
  isLoading,
  onActionClick,
}: MessageListProps) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col gap-4">
      {messages.map((msg, index) => (
        <ChatMessage
          key={msg.id || index}
          message={msg}
          onActionClick={onActionClick}
        />
      ))}

      {isLoading && (
        <div className="flex justify-start">
          <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Thinking...</span>
          </div>
        </div>
      )}
      <div ref={bottomRef} className="h-1" />
    </div>
  );
};

export default MessageList;
