"use client";

import Link from "next/link";
import Image from "next/image";

const LOGO_URL = "/logo.svg";

function handleScroll(e: React.MouseEvent<HTMLAnchorElement>, targetId: string) {
  const element = document.getElementById(targetId);
  if (element) {
    e.preventDefault();
    element.scrollIntoView({ behavior: "smooth" });
  }
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-[9px]" aria-label="Prompt Crafts home">
      <Image src={LOGO_URL} alt="" width={28} height={28} className="h-7 w-auto brightness-0" />
      <span className="text-[20px] font-bold tracking-[-0.3px] text-[#111]">Prompt Crafts</span>
    </Link>
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] gap-8 pb-11"
        >
          <div>
            <Logo />
            <p className="text-[13.5px] text-[#888] leading-[1.6] max-w-[300px] mt-[18px]">
              A platform for creators and developers to discover and share high quality AI prompt templates.
            </p>
          </div>

          {[
            {
              title: "Prompt Crafts",
              links: ["Marketplace", "Pricing", "Process"],
            },
            {
              title: "Legal",
              links: ["Terms", "Privacy"],
            },
          ].map((col) => (
            <div key={col.title}>
              <h5 className="text-[12px] font-semibold text-[#0f0f0f] uppercase tracking-[0.1em] mb-[14px]">
                {col.title}
              </h5>
              {col.links.map((link) => {
                const isLegal = link === "Terms" || link === "Privacy";
                const href = isLegal ? `/${link.toLowerCase()}` : `/#${link.toLowerCase().replace(/\s/g, "-")}`;
                return (
                  <Link
                    key={link}
                    href={href}
                    onClick={(e) => {
                      if (!isLegal) {
                        handleScroll(e, link.toLowerCase().replace(/\s/g, "-"));
                      }
                    }}
                    className="block text-[13.5px] text-[#1a1a1a] opacity-65 py-[5px] hover:opacity-100 transition-opacity"
                  >
                    {link}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="nexto-dashed" />

        <div className="flex items-center justify-between pt-6 text-[12.5px] text-[#888] gap-4 flex-wrap">
          <span>© 2026 Prompt Crafts — All rights reserved.</span>
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