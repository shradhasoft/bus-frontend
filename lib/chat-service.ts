import { Message } from "@/components/chat/chat-message";

// Mock Data for the Chatbot
const MOCK_OFFERS = [
  { code: "FIRST50", discount: "50% OFF", desc: "For first time users" },
  { code: "BUS200", discount: "₹200 OFF", desc: "On bookings above ₹1000" },
  { code: "SUMMER", discount: "15% OFF", desc: "Summer vacation special" },
];

const MOCK_BUS_STATUS = {
  status: "On Time",
  location: "Near Highway 42",
  eta: "2 hours 15 mins",
};

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

  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 800));

  // --- Offers Logic ---
  if (
    lowerInput.includes("offer") ||
    lowerInput.includes("code") ||
    lowerInput.includes("discount")
  ) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content: "Here are some exclusive offers for you! 🎉",
      timestamp: new Date(),
      type: "card",
      data: {
        title: "Latest Offers",
        subtitle: "Use these codes at checkout",
        details: MOCK_OFFERS.reduce(
          (acc, offer) => ({
            ...acc,
            [offer.code]: `${offer.discount} - ${offer.desc}`,
          }),
          {},
        ),
      },
    };
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
        "Sure! I can help you book a bus ticket. Please provide your source and destination cities, or use the search page directly.",
      timestamp: new Date(),
      type: "options",
      options: [
        { label: "Go to Search Page", value: "navigate_search" }, // In real app this would be a link or redirect
        { label: "Help me search", value: "help_search" },
      ],
    };
  }

  // --- Tracking Logic ---
  if (
    lowerInput.includes("track") ||
    lowerInput.includes("status") ||
    lowerInput.includes("where")
  ) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content: "Please enter your PNR number or Bus Number to track your bus.",
      timestamp: new Date(),
    };
  }

  // Handle PNR Pattern (Mock)
  if (
    /^[A-Z0-9]{6,10}$/i.test(input.trim()) ||
    input.toLowerCase().includes("pnr")
  ) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content: `Tracking details for ${input.toUpperCase()}:`,
      timestamp: new Date(),
      type: "card",
      data: {
        title: "Live Tracking",
        subtitle: "Bus 1234 - Volvo AC Multi Axle",
        details: {
          Status: MOCK_BUS_STATUS.status,
          "Current Location": MOCK_BUS_STATUS.location,
          ETA: MOCK_BUS_STATUS.eta,
        },
      },
    };
  }

  // --- Cancellation Logic ---
  if (lowerInput.includes("cancel") || lowerInput.includes("refund")) {
    return {
      id: Date.now().toString(),
      role: "bot",
      content:
        "To cancel a booking, please provide your PNR number. Note: Cancellation charges may apply.",
      timestamp: new Date(),
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
      { label: "Contact Support", value: "contact_support" },
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
      // This case might be handled by the UI/Hook to redirect
      return {
        id: Date.now().toString(),
        role: "bot",
        content: "Redirecting you to the booking page...",
        timestamp: new Date(),
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
