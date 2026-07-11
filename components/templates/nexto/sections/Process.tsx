const steps = [
  {
    icon: "explore",
    title: "Discover",
    body: "Browse our marketplace or build your custom prompt template in seconds.",
    meta: "Step 1",
  },
  {
    icon: "content_copy",
    title: "Copy",
    body: "Save your favorite prompts directly to your clipboard with a single click.",
    meta: "Step 2",
  },
  {
    icon: "bolt",
    title: "Use",
    body: "Paste your prompt into Claude or ChatGPT and get perfect outputs instantly.",
    meta: "Step 3",
  },
];

export default function Process() {
  return (
    <section className="nexto-section pt-[60px]" id="process">
      <div className="nexto-wrap">
        <div className="nexto-section-head">
          <div>
            <span className="nexto-eyebrow">PROCESS</span>
            <h2 className="mt-[18px]">
              Three steps.{" "}
              <em className="italic font-light">Done.</em>
            </h2>
          </div>
          <p className="nexto-section-lede">
            Simple workflows that save you hours. Copy, paste, and run.
          </p>
        </div>

        {/* Timeline connector row */}
        <div className="nexto-process-timeline">
          {steps.map((s, i) => (
            <div key={i} className="nexto-process-step">
              {/* Number node */}
              <div className="nexto-process-node-row">
                <div className="nexto-process-node">
                  <span className="text-[12px] font-bold text-[#111] tabular-nums">0{i + 1}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="nexto-process-connector" aria-hidden>
                    <div className="nexto-process-connector-line" />
                    <div className="nexto-process-connector-arrow" />
                  </div>
                )}
              </div>

              {/* Card */}
              <div className="nexto-card nexto-process-card">
                <span className="nexto-icon nexto-gradient-text text-[34px] leading-none">
                  {s.icon}
                </span>
                <h4 className="text-[17px] font-semibold tracking-[-0.3px] text-[#0f0f0f] mt-3">
                  {s.title}
                </h4>
                <p className="text-[13px] text-[#888] leading-[1.55] mt-2">{s.body}</p>
                <span className="nexto-process-meta">{s.meta}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
