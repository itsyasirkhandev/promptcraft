const works = [
  {
    title: "SEO Content Writer — Write high-ranking articles in minutes.",
    tags: ["Marketing", "SEO"],
    bg: "linear-gradient(135deg,#FFE9D6 0%,#F7B2FB 60%,#786EF1 100%)",
    tall: true,
  },
  {
    title: "Code Refactorer — Clean code buddy.",
    tags: ["Coding", "Development"],
    bg: "linear-gradient(135deg,#DDF3FF 0%,#5588FB 100%)",
  },
  {
    title: "Cold Emailer — High conversion template.",
    tags: ["Sales", "Email"],
    bg: "linear-gradient(135deg,#FFF1B6 0%,#FF9A5E 100%)",
  },
];

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

export default function Showcase() {
  return (
    <section className="nexto-section" id="marketplace">
      <div className="nexto-wrap">
        <div className="nexto-section-head">
          <div>
            <span className="nexto-eyebrow">MARKETPLACE</span>
            <h2 className="mt-[18px]">
              Ready to use{" "}
              <em className="italic font-light">
                prompts.
              </em>
            </h2>
          </div>
          <a href="#" className="nexto-pill-light">
            All prompts <ChevronArrow />
          </a>
        </div>

        <div
          className="grid gap-[14px] grid-cols-1 md:grid-cols-[1.4fr_1fr]"
        >
          {works.map((w, i) => (
            <a
              key={i}
              href="#"
              className={`relative rounded-[22px] overflow-hidden min-h-[340px] flex flex-col justify-end p-[22px] border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,0,0,0.08)] group ${w.tall ? "row-span-2" : ""}`}
              style={{ background: w.bg }}
            >
              <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/55 to-transparent" />

              {/* Content */}
              <div className="relative z-10 flex items-end justify-between gap-4 text-white">
                <div>
                  <h4 className="text-[22px] font-semibold tracking-[-0.5px]">
                    {w.title}
                  </h4>
                  <div className="flex gap-[6px] mt-[6px]">
                    {w.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11.5px] font-medium px-[10px] py-[3px] rounded-[40px] backdrop-blur-md bg-white/[0.18]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <span
                  className="nexto-icon w-[38px] h-[38px] rounded-full bg-white text-[#111] inline-flex items-center justify-center text-[20px] transition-transform duration-300 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] flex-shrink-0"
                >
                  north_east
                </span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
