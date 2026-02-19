"use client";

import React, { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ChatWindow from "./chat-window";

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div
        className={cn(
          "transition-all duration-300 ease-in-out origin-bottom-right",
          isOpen
            ? "scale-100 opacity-100 mb-4"
            : "scale-0 opacity-0 pointer-events-none",
        )}
      >
        <ChatWindow isOpen={isOpen} onClose={() => setIsOpen(false)} />
      </div>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className={cn(
          "h-14 w-14 rounded-full shadow-lg transition-transform duration-300 hover:scale-105 active:scale-95",
          isOpen
            ? "rotate-90 bg-destructive hover:bg-destructive/90"
            : "bg-primary hover:bg-primary/90",
        )}
      >
        {isOpen ? (
          <X className="h-6 w-6 text-white" />
        ) : (
          <MessageCircle className="h-7 w-7 text-white" />
        )}
      </Button>
    </div>
  );
};

export default ChatWidget;
