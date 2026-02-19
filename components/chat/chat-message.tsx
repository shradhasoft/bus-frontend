"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Bus, Bot } from "lucide-react";

export type MessageType = "text" | "options" | "card" | "error";

export interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  type?: MessageType;
  options?: { label: string; value: string }[];
  data?: Record<string, any>; // For flexible card data
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
  onActionClick?: (action: string) => void;
}

const ChatMessage = ({ message, onActionClick }: ChatMessageProps) => {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
    >
      {!isUser && (
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Bot className="h-5 w-5 text-primary" />
        </div>
      )}

      <div className="flex flex-col gap-2 max-w-[80%]">
        <div
          className={cn(
            "px-4 py-2.5 rounded-2xl text-sm shadow-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-none"
              : "bg-card border border-border/50 text-card-foreground rounded-tl-none",
          )}
        >
          {message.content}
        </div>

        {/* Options / Quick Actions */}
        {message.type === "options" && message.options && (
          <div className="flex flex-wrap gap-2 mt-1">
            {message.options.map((option) => (
              <Button
                key={option.value}
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-background hover:bg-primary hover:text-primary-foreground transition-colors border-primary/20"
                onClick={() => onActionClick?.(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        )}

        {/* Rich Cards (e.g., Bus Details) */}
        {message.type === "card" && message.data && (
          <div className="mt-2 p-3 bg-card border rounded-lg shadow-sm text-sm">
            {/* Render specific card content based on data structure */}
            {/* This is a generic placeholders, can be customized */}
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-md">
                <Bus className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">
                  {message.data.title || "Bus Details"}
                </p>
                <p className="text-muted-foreground text-xs">
                  {message.data.subtitle}
                </p>
                {message.data.details && (
                  <div className="mt-2 text-xs grid gap-1">
                    {Object.entries(message.data.details).map(([key, val]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="text-muted-foreground capitalize">
                          {key}:
                        </span>
                        <span className="font-medium">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {isUser && (
        <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-1">
          <User className="h-5 w-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
};

export default ChatMessage;
