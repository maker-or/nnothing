import React from "react";
import Header from "./Header";
import Link from "next/link";

const Landing = () => {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-black text-white">
      {/* Noise overlay */}
      <div
        className="absolute inset-0 z-10 opacity-25"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Prominent grid overlay */}
      <div
        className="absolute inset-0 z-20 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content layer */}
      <div className="relative z-30">
        <Header />

        {/* Hero Section */}
        <main className="flex min-h-[screen] w-full flex-col">
          {/* Top section with main heading */}
          <div className="flex items-center h-[100svh] w-[100svw] justify-center px-8 pt-20">
            <div className="text-center max-w-5xl">
              <h1 className="text-[3rem] md:text-[4rem] lg:text-[5.5rem] xl:text-[6.5rem] font-light leading-[0.9] tracking-tight text-white">
                <span className="block">
                  New <em className="font-serif italic font-light">Knowledge</em> layer for
                </span>
                <span className="block mt-2">
                  your <em className="font-serif italic font-light">collage</em>
                </span>
              </h1>
            </div>
          </div>

          {/* Bottom section with description */}
          <div className="px-8 pb-20 w-[100svw]  h-[100svh] items-center justify-center">
            <div className=" w-[100svw] h-[100svh] items-center justify-center">
              <div className="mb-6 items-center justify-center">
                <span className="text-4xl text-white/60 font-semibold tracking-tighter">
                  [What]
                </span>
              </div>
              <p className="text-5xl md:text-3xl lg:text-5xl font-light leading-none text-white/90 max-w-3xl">
                A deep search agent that will Create a Interactive structured sources on any topic or the concept that you want to master
              </p>
            </div>
          </div>

          <div className="px-8 pb-20 w-[100svw]  h-[100svh] items-center justify-center">
            <div className=" w-[100svw] h-[100svh] items-center justify-center">
              <div className="mb-6 items-center justify-center">
                <span className="text-4xl text-white/60 font-semibold tracking-tighter">
                  [Why]
                </span>
              </div>
              <p className="text-5xl md:text-3xl lg:text-5xl font-light leading-none text-white/90 max-w-3xl">
                When talking with the teachers about the use of AI in the education ,Most common concern is that student are just mugging up the answer and reproducing the respones in the exam , with out learning anything, So we are introducing Learn Mode , with the learn mode you can cook yourself a hot Seven stage course ,on any topic that you want to learn.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Landing;
