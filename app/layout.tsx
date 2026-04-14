import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://bookmyseat-eosin.vercel.app";
const SITE_NAME = "BookMySeat";
const SITE_DESCRIPTION =
  "Book bus tickets online instantly. Search routes, compare prices, and travel comfortably across India. Fast, secure, and hassle-free bus booking.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — India's Fastest Bus Ticket Booking`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "bus ticket booking",
    "online bus booking",
    "book bus tickets",
    "India bus booking",
    "bus reservation",
    "cheap bus tickets",
    "bus travel India",
    "intercity bus",
    "bus routes India",
    "BookMySeat",
  ],
  authors: [{ name: "BookMySeat", url: SITE_URL }],
  creator: "BookMySeat",
  publisher: "BookMySeat",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} — India's Fastest Bus Ticket Booking`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: `${SITE_URL}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: "BookMySeat — Book Bus Tickets Online",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — India's Fastest Bus Ticket Booking`,
    description: SITE_DESCRIPTION,
    images: [`${SITE_URL}/og-image.svg`],
    creator: "@bookmyseat",
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-IN": `${SITE_URL}/en`,
      "hi-IN": `${SITE_URL}/hi`,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.svg",
  },
  manifest: "/site.webmanifest",
  category: "travel",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
