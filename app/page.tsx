import Navbar from "@/components/templates/nexto/sections/Navbar";
import Hero from "@/components/templates/nexto/sections/Hero";
import Showcase from "@/components/templates/nexto/sections/Showcase";
import Process from "@/components/templates/nexto/sections/Process";
import Pricing from "@/components/templates/nexto/sections/Pricing";
import CTA from "@/components/templates/nexto/sections/CTA";
import Footer from "@/components/templates/nexto/sections/Footer";

export default function NextoPage() {
  return (
    <>
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
