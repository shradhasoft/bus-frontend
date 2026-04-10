// app/page.tsx
import type { Metadata } from "next";
import Hero from "@/components/hero";
import OffersSection from "@/components/home/OffersSection";
import ServicesSection from "@/components/home/ServicesSection";
import WhyChooseUsSection from "@/components/home/WhyChooseUsSection";
import PopularRoutesSection from "@/components/home/PopularRoutesSection";
import DownloadAppSection from "@/components/home/DownloadAppSection";
import FAQsSection from "@/components/home/FAQsSection";
import Testimonials from "@/components/home/testimonials";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Book Bus Tickets Online — Fast & Secure | BookMySeat",
  description:
    "Book bus tickets online instantly on BookMySeat. Search 1000+ routes, compare prices, choose your seat, and travel comfortably across India. Instant confirmation, easy cancellation.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Book Bus Tickets Online — Fast & Secure | BookMySeat",
    description:
      "Search 1000+ bus routes across India. Book tickets instantly with seat selection, live tracking, and easy cancellation.",
    url: "/",
  },
};

export default function Home() {
  return (
    <>
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <div>
        <Hero />
        <OffersSection />
        <ServicesSection />
        <WhyChooseUsSection />
        <Testimonials />
        <PopularRoutesSection />
        <DownloadAppSection />
        <FAQsSection />
      </div>
    </>
  );
}
