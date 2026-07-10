"use client";

import { useRef, useState, useEffect } from "react";

const services = [
  {
    icon: "design_services",
    title: "Brand & Identity",
    body: "Logo systems, type, voice and the visual instincts that travel across every surface your product lives on.",
    meta: "6 weeks · 2 sprints",
    accent: "nexto-tile-accent-pink",
  },
  {
    icon: "hub",
    title: "Product Design",
    body: "From a fuzzy idea to a working interface — research, wireframes and hi-fi prototypes you can actually ship.",
    meta: "8–12 weeks",
    accent: "nexto-tile-accent-purple",
  },
  {
    icon: "deployed_code",
    title: "Engineering",
    body: "Fast, friendly front-ends and back-ends. We hand off code your team will be glad to inherit on Monday.",
    meta: "Continuous",
    accent: "nexto-tile-accent-blue",
  },
  {
    icon: "rocket_launch",
    title: "Growth & Launch",
    body: "Strategy, positioning and the first 90 days — we help you find the audience that needs what you built.",
    meta: "4–6 weeks",
    accent: "nexto-tile-accent-green",
  },
];

export default function Services() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [grabbing, setGrabbing] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <section className="nexto-section overflow-hidden" id="solutions">
      {/* Header */}
      <div className="nexto-wrap">
        <div className="nexto-section-head">
          <div>
            <span className="nexto-eyebrow">solutions</span>
            <h2 className="mt-[18px]">
              The bits we{" "}
              <em className="italic font-light">obsess</em>{" "}
              over,
              <br />
              so you don&apos;t have to.
            </h2>
          </div>
          <p className="nexto-section-lede">
            Four practices, one studio. Scroll to explore what we bring —
            pick the ones that fit.
          </p>
        </div>
      </div>

      {/* Scroll track — bleeds past nexto-wrap padding */}
      <div
        ref={trackRef}
        onMouseDown={() => setGrabbing(true)}
        onMouseUp={() => setGrabbing(false)}
        onMouseLeave={() => setGrabbing(false)}
        className={`nexto-scroll-track ${grabbing ? "nexto-scroll-grabbing" : ""}`}
      >
        {/* Left pad to align with content */}
        <div className="nexto-scroll-pad" aria-hidden />

        {services.map((s, i) => (
          <div key={i} className={`nexto-scroll-tile nexto-card ${s.accent}`}>
            {/* Top accent area */}
            <div className="nexto-tile-top">
              <span className="nexto-icon nexto-gradient-text text-[38px] leading-none">
                {s.icon}
              </span>
              <span className="nexto-tile-num text-[12px] font-semibold text-[#aaa] tabular-nums">
                0{i + 1}
              </span>
            </div>

            {/* Content */}
            <div className="nexto-tile-body">
              <h3 className="text-[20px] font-semibold tracking-[-0.4px] text-[#0f0f0f]">
                {s.title}
              </h3>
              <p className="text-[14px] text-[#888] leading-[1.6] mt-2">{s.body}</p>
            </div>

            {/* Footer */}
            <div className="nexto-tile-footer">
              <span className="text-[12.5px] text-[#555] font-medium">{s.meta}</span>
              <span className="w-[30px] h-[30px] rounded-full bg-[#111] text-white inline-flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>
        ))}

        {/* Right pad */}
        <div className="nexto-scroll-pad" aria-hidden />
      </div>

      {/* Progress bar */}
      <div className="nexto-wrap mt-6">
        <div className="nexto-scroll-progress-track">
          <div
            className="nexto-scroll-progress-bar"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="text-[11.5px] text-[#bbb] mt-2 select-none">
          Scroll to explore →
        </p>
      </div>
    </section>
  );
}
