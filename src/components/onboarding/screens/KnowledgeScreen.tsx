'use client';

interface KnowledgeScreenProps {
  onAcceptChange?: (accepted: boolean) => void;
  isAccepted?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
}

const KnowledgeScreen = ({
  onAcceptChange,
  isAccepted,
  onNext,
  onBack,
  canGoBack = true,
  canGoNext = true
}: KnowledgeScreenProps) => {
  return (
    <div className="h-full w-full flex items-center justify-center px-6">
      {/* Card */}
      <div className="relative w-full max-w-5xl bg-[#2b2b2e] border border-white/10 rounded-[24px] shadow-2xl px-8 md:px-12 py-10 md:py-12">
        {/* Title */}
        <h1 className="text-left text-4xl md:text-6xl font-light text-white leading-tight mb-8">
          <span className="font-serif italic">Knowledge</span> library
        </h1>

        {/* Description */}
        <div className="space-y-6">
          <p className="text-left text-white/90 text-2xl md:text-4xl leading-snug font-light">
            All the courses created by you or any one with learn mode, will be available to every one to study
          </p>

          {/* Privacy note */}
          <p className="text-left text-orange-400/90 text-base md:text-lg font-medium italic">
            *everything in the chat mode will be private
          </p>
        </div>

        {/* Acceptance checkbox */}
        <div className="mt-10">
          <label className="inline-flex items-center space-x-4 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={isAccepted}
                onChange={(e) => onAcceptChange?.(e.target.checked)}
                className="w-6 h-6 md:w-7 md:h-7 rounded-md border-2 border-white/30 bg-white/10 appearance-none checked:bg-white checked:border-white transition-all duration-200 cursor-pointer"
              />
              {isAccepted && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <svg className="w-4 h-4 md:w-5 md:h-5 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </div>
            <span className="text-white/90 text-lg md:text-xl font-light group-hover:text-white transition-colors">
              I accept
            </span>
          </label>
        </div>

        {/* Navigation arrows (bottom-right inside card) */}
        <div className="absolute right-6 bottom-6 md:right-8 md:bottom-8 flex space-x-3 md:space-x-4">
          <button
            onClick={onBack}
            disabled={!canGoBack}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-[12px] flex items-center justify-center shadow-lg transition-all duration-200 ${
              canGoBack ? 'bg-white hover:bg-white/90 cursor-pointer' : 'bg-white/20 cursor-not-allowed'
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
              canGoNext && isAccepted
                ? 'bg-white hover:bg-white/90 cursor-pointer'
                : 'bg-white/20 cursor-not-allowed'
            }`}
            aria-label="Next"
          >
            <svg
              className={`w-6 h-6 md:w-7 md:h-7 ${canGoNext && isAccepted ? 'text-black' : 'text-black/30'}`}
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

export default KnowledgeScreen;
