import React from "react";
import Header from "./Header";
import Link from "next/link";

const Landing = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Subtle grid background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.15) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage:
            "radial-gradient(ellipse at center, black 50%, transparent 85%)",
          WebkitMaskImage:
            "radial-gradient(ellipse at center, black 50%, transparent 85%)",
        }}
      />
      {/* Ambient radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[60rem] w-[60rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(255,94,0,0.18), transparent 75%)",
        }}
      />

      <Header />

      {/* Hero */}
      <main className="relative mx-auto flex max-w-6xl flex-col items-center justify-center px-6 pt-36 md:pt-44">
        <h1 className="text-center font-semibold leading-[1.06] tracking-tight text-white">
          <span className="block text-[2.5rem] leading-[1.05] md:text-[3.5rem] lg:text-[4.5rem]">
            New{" "}
            <span className="italic text-white/90">Knowledge</span> layer for
          </span>
          <span className="mt-1 block text-[2.5rem] leading-[1.05] md:text-[3.5rem] lg:text-[4.5rem]">
            your <span className="italic text-white/90">collage</span>
          </span>
        </h1>

        {/* Optional CTA below hero (kept subtle to match design) */}
        <div className="mt-8 flex items-center gap-4">
          <Link
            href="/select"
            className="rounded-full bg-[#FF5E00] px-6 py-2 text-base font-medium text-black transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#FF5E00]/60"
          >
            Get started
          </Link>
          <span className="text-sm text-white/60">No sign-in yet? Start here</span>
        </div>

        {/* Divider */}
        <div className="mt-16 h-px w-full bg-white/10" />
      </main>

      {/* What section */}
      <section className="relative mx-auto max-w-4xl px-6 py-14 md:py-20">
        <div className="mb-4 text-lg text-white/50">
          <span className="font-medium tracking-wide">[What]</span>
        </div>
        <p className="text-xl leading-relaxed text-white/90 md:text-2xl">
          A deep search agent that will Create a Interactive structured sources
          on any topic or the concept that you want to master
        </p>
      </section>
    </div>
  );
};

export default Landing;
