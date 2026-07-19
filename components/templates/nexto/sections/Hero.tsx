import { SignInButton, Show } from "@clerk/nextjs";
import Link from "next/link";

function ChevronArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const avatars = [
  { initials: "RM", style: { background: "linear-gradient(135deg,#F7B2FB,#786EF1)" } },
  { initials: "JK", style: { background: "linear-gradient(135deg,#FFE9D6,#FF9A5E)" } },
  { initials: "AT", style: { background: "linear-gradient(135deg,#DDF3FF,#5588FB)" } },
  { initials: "+24", style: { background: "#0f0f0f", color: "#fff", fontSize: 11 } },
];

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center relative min-h-[calc(100vh-84px)] px-5 pt-10 pb-[60px]">
      <div className="max-w-[700px] w-full flex flex-col items-center">
        <p className="text-[15px] text-[#888] font-normal mb-[14px]">
          Better AI inputs. Better AI outputs.
        </p>

        <div className="relative inline-block mb-[18px]">
          <span className="nexto-gradient-text nexto-icon nexto-float-cloud absolute">
            cloud
          </span>
          <span className="nexto-gradient-text nexto-icon nexto-float-star absolute">
            favorite
          </span>
          <h1 className="text-[clamp(34px,5vw,52px)] font-medium tracking-[-1.5px] leading-[1.08] text-[#0f0f0f]">
            Craft prompts.
            <br />
            Save hours.
          </h1>
        </div>

        <p className="text-[14px] text-[#888] leading-[1.7] max-w-[470px] mx-auto mb-7">
          Stop wrestling with AI instructions. Create, organize, and copy your perfect prompts. Free for up to 30 prompts.
        </p>

        <div className="flex items-center gap-[18px] flex-wrap justify-center mb-9">
          <Show when="signed-out">
            <SignInButton mode="modal" fallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard">
              <button type="button" className="nexto-pill-dark lg">
                <span className="nexto-arrow-circ lg">
                  <ChevronArrow />
                </span>
                Sign In / Sign Up
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <Link href="/dashboard" className="nexto-pill-dark lg">
              <span className="nexto-arrow-circ lg">
                <ChevronArrow />
              </span>
              Go to Dashboard
            </Link>
          </Show>
          <a
            href="#marketplace"
            className="inline-flex items-center gap-[10px] text-[14px] font-medium text-[#1a1a1a] hover:opacity-70 transition-opacity"
          >
            <span className="nexto-icon w-[30px] h-[30px] rounded-full bg-white border border-black/8 inline-flex items-center justify-center text-[18px] text-[#111] shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
              shopping_bag
            </span>
            Browse marketplace
          </a>
        </div>

        <div className="inline-flex items-center gap-[14px] rounded-[40px] px-[18px] py-[6px] pl-[6px] bg-white/55 border border-black/5 backdrop-blur-[8px]">
          <div className="flex">
            {avatars.map((a, i) => (
              <span
                key={i}
                className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-white text-[11px] font-bold border-2 border-[#F5F5F5] ${i > 0 ? "-ml-2" : ""}`}
                style={a.style}
              >
                {a.initials}
              </span>
            ))}
          </div>
          <div className="flex flex-col leading-[1.3]">
            <strong className="text-[12.5px] font-semibold text-[#0f0f0f]">
              1,200+ prompts created
            </strong>
            <span className="text-[11.5px] text-[#888]">
              by developers and creators worldwide.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
