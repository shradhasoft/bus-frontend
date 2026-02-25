"use client";

import { useState, useCallback } from "react";
import { Message } from "@/components/chat/chat-message";
import {
  GET_INITIAL_MESSAGE,
  processUserMessage,
  handleQuickAction,
} from "@/lib/chat-service";
import { useRouter } from "next/navigation";

export const useChat = () => {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([GET_INITIAL_MESSAGE()]);
  const [isLoading, setIsLoading] = useState(false);

  const addMessage = (msg: Message) => {
    setMessages((prev) => [...prev, msg]);
  };

  const sendMessage = useCallback(
    async (content: string) => {
      // Check for navigation actions first
      if (content === "navigate_search") {
        router.push("/bus-tickets");
        return;
      }
      if (content === "navigate_bookings") {
        router.push("/dashboard/bookings");
        return;
      }

      // Add user message
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content,
        timestamp: new Date(),
      };
      addMessage(userMsg);
      setIsLoading(true);

      try {
        // Check if it's a quick action code or natural language
        const isQuickAction = [
          "book_ticket",
          "track_bus",
          "cancel_booking",
          "view_offers",
          "contact_support",
        ].includes(content);

        const response = isQuickAction
          ? await handleQuickAction(content)
          : await processUserMessage(content);

        if (response) {
          addMessage(response);
          // Handle navigation command from bot response if needed
          if (response.content.includes("Redirecting")) {
            if (response.options?.[0]?.value === "navigate_bookings") {
              setTimeout(() => router.push("/dashboard/bookings"), 1000);
            } else {
              setTimeout(() => router.push("/bus-tickets"), 1000);
            }
          }
        }
      } catch {
        addMessage({
          id: Date.now().toString(),
          role: "bot",
          content:
            "Sorry, I'm having trouble connecting right now. Please try again.",
          timestamp: new Date(),
          type: "error",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  const resetChat = useCallback(() => {
    setMessages([GET_INITIAL_MESSAGE()]);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    resetChat,
  };
};
