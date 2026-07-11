import Navbar from "@/components/templates/nexto/sections/Navbar";
import Footer from "@/components/templates/nexto/sections/Footer";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main className="nexto-section min-h-[70vh]">
        <div className="nexto-wrap max-w-[800px] mx-auto px-5 py-12">
          <div className="nexto-section-head mb-12">
            <span className="nexto-eyebrow">LEGAL</span>
            <h1 className="text-[38px] font-medium tracking-[-1.5px] text-[#0f0f0f] mt-3">
              Terms of Service
            </h1>
            <p className="text-[14px] text-[#888] mt-2">
              Last updated: July 11, 2026
            </p>
          </div>

          <div className="nexto-dashed mb-10" />

          <article className="space-y-8 text-[14.5px] leading-[1.7] text-[#1a1a1a] opacity-85">
            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing or using Prompt Crafts, you agree to follow and be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                2. Description of Service
              </h2>
              <p>
                Prompt Crafts is a platform that allows you to create, organize, share, and discover AI prompts. We offer two main plans:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>
                  <strong>Hobby Plan:</strong> Free ($0/mo). Limited to creating a maximum of 30 prompts and sharing up to 10 prompts publicly.
                </li>
                <li>
                  <strong>Pro Plan:</strong> Paid ($5/mo). Gives you unlimited prompt creation and unlimited public sharing.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                3. User Accounts and Content
              </h2>
              <p>
                You are responsible for keeping your account details safe. You own all the rights to the prompts you create on Prompt Crafts. By sharing a prompt publicly, you grant other users a license to copy and use it for their own purposes.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                4. Acceptable Use
              </h2>
              <p>
                You must not use our service to create or share prompts that promote hate speech, illegal acts, or violate anyone else&apos;s rights. We reserve the right to remove any content or suspend accounts that violate these terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-[20px] font-semibold tracking-[-0.5px] text-[#0f0f0f]">
                5. Limitation of Liability
              </h2>
              <p>
                Prompt Crafts is provided &quot;as is&quot;. We are not liable for any issues, loss of data, or damages that result from using or not being able to use our platform.
              </p>
            </section>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
