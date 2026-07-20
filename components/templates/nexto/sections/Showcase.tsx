"use client";

import Link from "next/link";
import Image from "next/image";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

function ChevronArrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
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

/**
 * One gradient per category, reusing the nexto palette in globals.css
 * (--gradient-pink #f7b2fb, --gradient-purple #786ef1, --gradient-blue #5588fb)
 * plus warm/neutral accents for the categories the original hardcoded cards
 * did not cover. Kept here (not in categories.ts) because this is purely a
 * landing-section visual concern, not a shared domain value.
 */
const CATEGORY_GRADIENTS: Record<string, string> = {
  coding: "linear-gradient(135deg,#DDF3FF 0%,#5588FB 100%)",
  writing: "linear-gradient(135deg,#FFE9D6 0%,#F7B2FB 60%,#786EF1 100%)",
  marketing: "linear-gradient(135deg,#FFF1B6 0%,#FF9A5E 100%)",
  analysis: "linear-gradient(135deg,#D7F5E8 0%,#34D399 100%)",
  design: "linear-gradient(135deg,#F7B2FB 0%,#786EF1 100%)",
  education: "linear-gradient(135deg,#DDF3FF 0%,#786EF1 100%)",
  other: "linear-gradient(135deg,#E9EBF0 0%,#9CA3AF 100%)",
};

const FALLBACK_GRADIENT =
  "linear-gradient(135deg,#FFE9D6 0%,#F7B2FB 60%,#786EF1 100%)";

const CATEGORY_LABELS: Record<string, string> = {
  coding: "Coding",
  writing: "Writing",
  marketing: "Marketing",
  analysis: "Analysis",
  design: "Design",
  education: "Education",
  other: "Other",
};

export default function Showcase() {
  // Public, unauthenticated read of the newest public prompts — the same query
  // the /marketplace page uses, so the landing section always reflects real
  // data instead of the old hardcoded cards.
  const prompts = useQuery(api.public.prompts.listPublicPrompts, {
    sortBy: "recent",
  });

  const isLoading = prompts === undefined;
  // The landing section only teases the marketplace; the full list lives at
  // /marketplace. The query is already bounded (take 50) server-side.
  const visible = (prompts ?? []).slice(0, 6);

  return (
    <section className="nexto-section" id="marketplace">
      <div className="nexto-wrap">
        <div className="nexto-section-head">
          <div>
            <span className="nexto-eyebrow">MARKETPLACE</span>
            <h2 className="mt-[18px]">
              Ready to use{" "}
              <em className="italic font-light">prompts.</em>
            </h2>
          </div>
          <Link href="/marketplace" className="nexto-pill-light">
            All prompts <ChevronArrow />
          </Link>
        </div>

        <div className="grid gap-[14px] grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="rounded-[22px] min-h-[300px] animate-pulse border border-black/5 bg-[linear-gradient(135deg,#EAEAEF_0%,#E3E3EA_100%)]"
                />
              ))
            : visible.length === 0
            ? (
              <div className="col-span-full rounded-[22px] border border-dashed border-black/10 bg-white/50 px-6 py-16 text-center">
                <span className="nexto-icon nexto-gradient-text text-[34px] leading-none">
                  storefront
                </span>
                <h4 className="mt-3 text-[18px] font-semibold tracking-[-0.3px] text-[#0f0f0f]">
                  No public prompts yet
                </h4>
                <p className="mt-2 text-[13px] text-[#888] max-w-[320px] mx-auto">
                  Be the first to share a prompt and it will appear right here.
                </p>
                <Link
                  href="/marketplace"
                  className="nexto-pill-light mt-5 inline-flex"
                >
                  Browse marketplace <ChevronArrow />
                </Link>
              </div>
            )
            : visible.map((p) => {
                const bg =
                  CATEGORY_GRADIENTS[p.category ?? ""] ?? FALLBACK_GRADIENT;
                const categoryLabel =
                  CATEGORY_LABELS[p.category ?? ""] ?? "Prompt";
                const href = p.publicSlug ? `/p/${p.publicSlug}` : "/marketplace";
                const authorName = p.author.name || "Anonymous";

                return (
                  <Link
                    key={p._id}
                    href={href}
                    className="relative rounded-[22px] overflow-hidden min-h-[300px] flex flex-col justify-end p-[22px] border border-black/5 shadow-[0_2px_12px_rgba(0,0,0,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_36px_rgba(0,0,0,0.08)] group"
                    style={{ background: bg }}
                  >
                    <div className="absolute inset-0 z-0 bg-gradient-to-t from-black/60 to-transparent" />

                    {/* Content */}
                    <div className="relative z-10 flex flex-col gap-[10px] text-white">
                      <span className="self-start text-[11px] font-medium px-[10px] py-[3px] rounded-[40px] backdrop-blur-md bg-white/[0.2]">
                        {categoryLabel}
                      </span>

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-[20px] font-semibold tracking-[-0.5px] leading-[1.15] line-clamp-2">
                            {p.title}
                          </h4>
                          {p.content && (
                            <p className="mt-[6px] text-[12.5px] leading-[1.5] text-white/80 line-clamp-2">
                              {p.content}
                            </p>
                          )}
                        </div>
                        <span
                          className="nexto-icon w-[38px] h-[38px] rounded-full bg-white text-[#111] inline-flex items-center justify-center text-[20px] transition-transform duration-300 group-hover:translate-x-[3px] group-hover:-translate-y-[3px] flex-shrink-0"
                        >
                          north_east
                        </span>
                      </div>

                      {p.tags.length > 0 && (
                        <div className="flex flex-wrap gap-[6px]">
                          {p.tags.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[11px] font-medium px-[9px] py-[2px] rounded-[40px] backdrop-blur-md bg-white/[0.18]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-[7px] pt-[8px] border-t border-white/15">
                        {p.author.avatarUrl ? (
                          <Image
                            src={p.author.avatarUrl}
                            alt={authorName}
                            width={20}
                            height={20}
                            className="size-5 rounded-full border border-white/60 object-cover"
                          />
                        ) : (
                          <span className="size-5 rounded-full bg-white/25 border border-white/40 inline-flex items-center justify-center text-[10px] font-semibold text-white">
                            {authorName.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span className="text-[11.5px] font-medium text-white/90 max-w-[150px] truncate">
                          {authorName}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}