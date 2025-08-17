'use client';

interface IntroScreenProps {
  onAcceptChange?: (accepted: boolean) => void;
  isAccepted?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
}

const IntroScreen = ({
  onAcceptChange,
  isAccepted,
  onNext,
  onBack,
  canGoBack = false,
  canGoNext = true
}: IntroScreenProps) => {
  return (
    <div className="h-full w-full flex items-center justify-center px-6">
      {/* Card */}
      <div className="relative w-full max-w-5xl bg-[#2b2b2e] border border-white/10 rounded-[24px] shadow-2xl px-8 md:px-12 py-10 md:py-12">
        {/* Title */}
        <h1 className="text-left text-4xl md:text-6xl font-light text-white leading-tight mb-8">
          Introducing <span className="font-serif italic text-orange-400">Learn</span> Mode
        </h1>

        {/* Tab visualization */}
        <div className="rounded-3xl bg-[#171718] border border-white/10 p-4 md:p-6 mb-10">
          <div className="grid grid-cols-3 rounded-2xl overflow-hidden border border-white/10">
            {/* Left (chat) */}
            <div className="h-16 md:h-20 flex items-center justify-center text-2xl text-white/40 font-light">
              chat
            </div>
            {/* Middle (Learn) with vertical borders to mimic separators */}
            <div className="h-16 md:h-20 flex items-center justify-center text-3xl text-white font-medium border-x border-white/20">
              Learn
            </div>
            {/* Right empty column to mirror layout in mock */}
            <div className="h-16 md:h-20 flex items-center justify-center text-2xl text-white/40 font-light">
              Knowledge library
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-left text-white/90 text-2xl md:text-3xl leading-relaxed font-light pr-28 md:pr-40">
          Easily create a interactive structured course on any topic that you want to master
        </p>

        {/* Navigation arrows (bottom-right inside card) */}
        <div className="absolute right-6 bottom-6 md:right-8 md:bottom-8 flex space-x-3 md:space-x-4">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-[12px] flex items-center justify-center shadow-lg transition-all duration-200 ${
              canGoBack
                ? 'bg-white hover:bg-white/90 cursor-pointer'
                : 'bg-white/20 cursor-not-allowed'
            }`}
            aria-label="Previous"
          >
            <svg
              className={`w-6 h-6 md:w-7 md:h-7 ${canGoBack ? 'text-black' : 'text-black/30'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={onNext}
            disabled={!canGoNext}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-[12px] flex items-center justify-center shadow-lg transition-all duration-200 ${
              canGoNext
                ? 'bg-white hover:bg-white/90 cursor-pointer'
                : 'bg-white/20 cursor-not-allowed'
            }`}
            aria-label="Next"
          >
            <svg
              className={`w-6 h-6 md:w-7 md:h-7 ${canGoNext ? 'text-black' : 'text-black/30'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IntroScreen;
