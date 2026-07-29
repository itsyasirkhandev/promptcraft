import Navbar from "@/components/templates/nexto/sections/Navbar";
import Hero from "@/components/templates/nexto/sections/Hero";
import Showcase from "@/components/templates/nexto/sections/Showcase";
import Process from "@/components/templates/nexto/sections/Process";
import Pricing from "@/components/templates/nexto/sections/Pricing";
import CTA from "@/components/templates/nexto/sections/CTA";
import Footer from "@/components/templates/nexto/sections/Footer";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Prompt Crafts",
  "applicationCategory": "DeveloperApplication",
  "operatingSystem": "All",
  "description": "Craft, optimize, organize, and copy your perfect AI prompts.",
  "offers": {
    "@type": "Offer",
    "price": "0.00",
    "priceCurrency": "USD"
  }
};

export default function NextoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <Navbar />
      <Hero />
      <Showcase />
      <Process />
      <Pricing />
      <CTA />
      <Footer />
    </>
  );
}
