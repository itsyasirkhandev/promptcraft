import Navbar from "@/components/templates/nexto/sections/Navbar";
import Hero from "@/components/templates/nexto/sections/Hero";
import LogosStrip from "@/components/templates/nexto/sections/LogosStrip";
import Services from "@/components/templates/nexto/sections/Services";
import Showcase from "@/components/templates/nexto/sections/Showcase";
import Numbers from "@/components/templates/nexto/sections/Numbers";
import Process from "@/components/templates/nexto/sections/Process";
import Testimonial from "@/components/templates/nexto/sections/Testimonial";
import CTA from "@/components/templates/nexto/sections/CTA";
import Footer from "@/components/templates/nexto/sections/Footer";

export default function NextoPage() {
  return (
    <>
      <Navbar />
      <Hero />
      <LogosStrip />
      <Services />
      <Showcase />
      <Numbers />
      <Process />
      <Testimonial />
      <CTA />
      <Footer />
    </>
  );
}
