import { Message } from "@/components/chat/chat-message";
import { apiUrl } from "@/lib/api";

// Initial Greeting
export const GET_INITIAL_MESSAGE = (): Message => ({
  id: "init-1",
  role: "bot",
  content: "Hi there! 👋 I'm your Bus Assistant. How can I help you today?",
  timestamp: new Date(),
  type: "options",
  options: [
    { label: "Book a Ticket", value: "book_ticket" },
    { label: "Track my Bus", value: "track_bus" },
    { label: "Cancel Booking", value: "cancel_booking" },
    { label: "View Offers", value: "view_offers" },
  ],
});

// Intent Processing
export const processUserMessage = async (input: string): Promise<Message> => {
  const lowerInput = input.toLowerCase();

  // --- Offers Logic ---
  if (
    lowerInput.includes("offer") ||
    lowerInput.includes("code") ||
    lowerInput.includes("discount")
  ) {
    try {
      const response = await fetch(apiUrl("/offers"), { method: "GET" });
      const payload = await response.json();

      if (payload.success && payload.data?.length > 0) {
        return {
          id: Date.now().toString(),
          role: "bot",
          content: "Here are some exclusive offers for you! 🎉",
          timestamp: new Date(),
          type: "card",
          data: {
            title: "Latest Offers",
            subtitle: "Use these codes at checkout",
            details: payload.data.reduce(
              (
                acc: Record<string, string>,
                offer: {
                  promoCode: string;
                  discountValue: number;
                  discountType: string;
                  title: string;
                },
              ) => ({
                ...acc,
                [offer.promoCode]: `${offer.discountValue}${offer.discountType === "percentage" ? "% OFF" : "₹ OFF"} - ${offer.title}`,
              }),
              {},
            ),
          },
        };
      } else {
        return {
          id: Date.now().toString(),
          role: "bot",
          content:
            "I couldn't find any active offers right now. Please check back later!",
          timestamp: new Date(),
        };
      }
    } catch {
      return {
        id: Date.now().toString(),
        role: "bot",
        content: "Oops! I encountered an error checking for offers.",
        timestamp: new Date(),
      };
    }
  }

  // --- Booking Logic ---
  if (
    lowerInput.includes("book") ||
    lowerInput.includes("ticket") ||
    lowerInput.includes("search")
  ) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content:
        "Sure! I can help you book a bus ticket. Please proceed to the search page.",
      timestamp: new Date(),
      type: "options",
      options: [{ label: "Go to Search Page", value: "navigate_search" }],
    };
  }

  // Handle Track Bus explicit trigger
  if (
    lowerInput === "track my bus" ||
    lowerInput === "track bus" ||
    lowerInput === "track_bus"
  ) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content:
        "Please enter your Bus Number (e.g. OD09A9100) to track your bus.",
      timestamp: new Date(),
    };
  }

  // --- Tracking Logic via Pattern Matching for Bus Number ---
  const possibleBusNumber = input.trim().replace(/\s+/g, "").toUpperCase();
  if (
    /^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/.test(possibleBusNumber) ||
    lowerInput.includes("track")
  ) {
    const busNumMatch = input.match(
      /[A-Z]{2}\s?[0-9]{1,2}\s?[A-Z]{1,2}\s?[0-9]{1,4}/i,
    );
    const busNumberToTrack = busNumMatch
      ? busNumMatch[0].replace(/\s+/g, "").toUpperCase()
      : possibleBusNumber;

    if (!/^[A-Z]{2}[0-9]{1,2}[A-Z]{1,2}[0-9]{1,4}$/.test(busNumberToTrack)) {
      return {
        id: Date.now().toString(),
        role: "bot",
        content: "Please provide a valid bus number to track (e.g. OD09A9100).",
        timestamp: new Date(),
      };
    }

    try {
      const response = await fetch(
        apiUrl(`/v1/tracking/bus/${busNumberToTrack}/latest`),
        {
          method: "GET",
        },
      );
      const payload = await response.json();

      if (payload.success && payload.data) {
        const data = payload.data;
        return {
          id: Date.now().toString(),
          role: "bot",
          content: `Tracking details for ${busNumberToTrack}:`,
          timestamp: new Date(),
          type: "card",
          data: {
            title: "Live Tracking",
            subtitle: `Bus ${busNumberToTrack}`,
            details: {
              Status: data.status || "Unknown",
              "Current Speed": `${data.metrics?.speed || 0} km/h`,
              "Last Updated": new Date(data.timestamp).toLocaleTimeString(),
            },
          },
        };
      } else {
        return {
          id: Date.now().toString(),
          role: "bot",
          content: `I couldn't find active tracking data for bus ${busNumberToTrack}. It might not be on a trip right now.`,
          timestamp: new Date(),
        };
      }
    } catch {
      return {
        id: Date.now().toString(),
        role: "bot",
        content: "Sorry, I had trouble tracking that bus. Please try again.",
        timestamp: new Date(),
      };
    }
  }

  // --- Cancellation Logic ---
  if (lowerInput.includes("cancel") || lowerInput.includes("refund")) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content:
        "To cancel a booking, please go to your dashboard 'My Bookings' section. Cancellation charges may apply based on the policy.",
      timestamp: new Date(),
      type: "options",
      options: [{ label: "Go to My Bookings", value: "navigate_bookings" }],
    };
  }

  // --- Default Fallback ---
  return {
    id: Date.now().toString(),
    role: "bot",
    content:
      "I'm not sure I understand. Could you please select an option or try asking in a different way?",
    timestamp: new Date(),
    type: "options",
    options: [
      { label: "Book Ticket", value: "book_ticket" },
      { label: "Track Bus", value: "track_bus" },
      { label: "Cancel Booking", value: "cancel_booking" },
      { label: "View Offers", value: "view_offers" },
    ],
  };
};

export const handleQuickAction = async (
  action: string,
): Promise<Message | null> => {
  switch (action) {
    case "book_ticket":
      return processUserMessage("I want to book a ticket");
    case "track_bus":
      return processUserMessage("Track my bus");
    case "cancel_booking":
      return processUserMessage("I want to cancel my booking");
    case "view_offers":
      return processUserMessage("Show me offers");
    case "navigate_search":
      return {
        id: Date.now().toString(),
        role: "bot",
        content: "Redirecting you to the booking page...",
        timestamp: new Date(),
        options: [{ label: "Search", value: "navigate_search" }],
      };
    case "navigate_bookings":
      return {
        id: Date.now().toString(),
        role: "bot",
        content: "Redirecting you to your bookings...",
        timestamp: new Date(),
        options: [{ label: "Bookings", value: "navigate_bookings" }],
      };
    case "contact_support":
      return {
        id: Date.now().toString(),
        role: "bot",
        content:
          "You can reach our support team at support@example.com or call 1800-123-4567.",
        timestamp: new Date(),
      };
    default:
      return processUserMessage(action);
  }
};
