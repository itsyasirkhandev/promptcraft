const LOGO_URL =
  "https://pub-f170a2592d2c4a1485466404c36807be.r2.dev/Tests/logoipsum-415.svg";

function Logo() {
  return (
    <a href="#" className="flex items-center gap-[9px]" aria-label="nexto home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LOGO_URL} alt="" className="h-7 brightness-0" />
      <span className="text-[20px] font-bold tracking-[-0.3px] text-[#111]">nexto.</span>
    </a>
  );
}

const socials = [
  { label: "Twitter", icon: "alternate_email" },
  { label: "Instagram", icon: "camera_alt" },
  { label: "LinkedIn", icon: "work" },
  { label: "Dribbble", icon: "sports_basketball" },
];

export default function Footer() {
  return (
    <footer className="pt-[60px] pb-10 bg-transparent relative">
      <div className="nexto-wrap">
        <div className="nexto-dashed mb-12" />

        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-8 pb-11"
        >
          <div>
            <Logo />
            <p className="text-[13.5px] text-[#888] leading-[1.6] max-w-[300px] mt-[18px]">
              A small studio for curious teams. Brand, product and engineering —
              under one roof, since 2019.
            </p>
          </div>

          {[
            {
              title: "Studio",
              links: ["Our Team", "Process", "Careers", "News"],
            },
            {
              title: "Work",
              links: ["Case studies", "Showcase", "Lab", "Press"],
            },
            {
              title: "Say hi",
              links: [
                "hello@nexto.studio",
                "+1 415 555 0143",
                "Pier 9, San Francisco",
                "Kreuzberg, Berlin",
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <h5 className="text-[12px] font-semibold text-[#0f0f0f] uppercase tracking-[0.1em] mb-[14px]">
                {col.title}
              </h5>
              {col.links.map((link) => (
                <a
                  key={link}
                  href={link.includes("@") ? `mailto:${link}` : "#"}
                  className="block text-[13.5px] text-[#1a1a1a] opacity-65 py-[5px] hover:opacity-100 transition-opacity"
                >
                  {link}
                </a>
              ))}
            </div>
          ))}
        </div>

        <div className="nexto-dashed" />

        <div className="flex items-center justify-between pt-6 text-[12.5px] text-[#888] gap-4 flex-wrap">
          <span>© 2026 nexto. studio — All rights reserved.</span>
          <div className="flex gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href="#"
                aria-label={s.label}
                className="nexto-icon w-[34px] h-[34px] rounded-full bg-white border border-black/6 inline-flex items-center justify-center text-[18px] text-[#111] transition-all hover:-translate-y-[2px] hover:shadow-[0_6px_18px_rgba(0,0,0,0.08)]"
              >
                {s.icon}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
