import Navbar from "@/components/templates/nexto/sections/Navbar";
import Footer from "@/components/templates/nexto/sections/Footer";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="nexto-section min-h-[70vh]">
        <div className="nexto-wrap max-w-[800px] mx-auto px-5 py-12">
          <div className="nexto-section-head mb-12">
            <span className="nexto-eyebrow">LEGAL</span>
            <h1 className="text-[38px] font-medium tracking-[-1.5px] text-[#0f0f0f] mt-3">
              Privacy Policy
            </h1>
            <p className="text-[14px] text-[#888] mt-2">
              Last updated: July 11, 2026
            </p>
          </div>

          <div className="nexto-dashed mb-10" />

          <article className="space-y-8 text-[14.5px] leading-[1.7] text-[#1a1a1a] opacity-85">
            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                1. Information We Collect
              </h2>
              <p>
                We collect information when you create an account, update your profile, or build prompts on our site:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Account Information:</strong> Your name, email, and authentication info (managed securely via Clerk).
                </li>
                <li>
                  <strong>Content:</strong> The prompts you create, organize, and choose to share publicly or keep private.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                2. How We Use Your Information
              </h2>
              <p>
                We use the information we collect to run, maintain, and improve our services. This includes syncing your account details with our database provider (Convex) and processing payments if you upgrade to the Pro plan.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                3. Cookies and Analytics
              </h2>
              <p>
                We use cookies and similar technologies to keep you logged in and understand how you interact with Prompt Crafts so we can make the app better for you.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                4. Data Security
              </h2>
              <p>
                We use industry-standard security measures to safeguard your personal data. However, no database or transmission over the internet is completely secure. We work with trusted third-party partners like Clerk and Convex to keep your data safe.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                5. Your Choices and Rights
              </h2>
              <p>
                You can access, modify, or delete your account information at any time through your dashboard settings. You also have the right to request a copy of the data we store about you.
              </p>
            </section>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
