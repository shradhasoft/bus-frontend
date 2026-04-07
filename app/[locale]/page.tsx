// app/page.tsx
import Hero from "@/components/hero";
import OffersSection from "@/components/home/OffersSection";
import ServicesSection from "@/components/home/ServicesSection";
import WhyChooseUsSection from "@/components/home/WhyChooseUsSection";
import PopularRoutesSection from "@/components/home/PopularRoutesSection";
import DownloadAppSection from "@/components/home/DownloadAppSection";
import FAQsSection from "@/components/home/FAQsSection";
import Testimonials from "@/components/home/testimonials";

export default function Home() {
  return (
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
  );
}
