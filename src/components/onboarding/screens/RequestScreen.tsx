'use client';

interface RequestScreenProps {
  onAcceptChange?: (accepted: boolean) => void;
  isAccepted?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
}

const RequestScreen = ({
  // kept for API compatibility with other screens
  onAcceptChange,
  isAccepted,
  onNext,
  onBack,
  canGoBack = true,
  canGoNext = true
}: RequestScreenProps) => {
  return (
    <div className="h-full w-full flex items-center justify-center px-6">
      {/* Card */}
      <div className="relative w-full max-w-5xl bg-[#2b2b2e] border border-white/10 rounded-[24px] shadow-2xl px-8 md:px-12 py-10 md:py-12">
        {/* Title */}
        <h1 className="text-left text-4xl md:text-6xl font-light text-white leading-tight mb-6">
          <span className="font-serif italic">Small Request</span>
        </h1>

        {/* Main message */}
        <p className="text-left text-white/90 text-2xl md:text-4xl leading-none font-light mb-3 pr-4">
          Creating a course on Learn mode will require{' '}
          <span className="font-medium text-white">20-30 times more tokens</span>{' '}
          compared to any chat app, given the same prompt.{' '}
          <span className=" text-white">
            Therefore, please use it only if you genuinely wish to <span className="font-serif italic" > learn something.</span>
          </span>
        </p>

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

            className={`w-12 h-12 md:w-14 md:h-14 rounded-[12px] flex items-center justify-center shadow-lg transition-all duration-200 bg-white hover:bg-white/90 cursor-pointer
            `}
            aria-label="Next"
          >
            <svg
              className={`w-6 h-6 md:w-7 md:h-7 'text-black}`}
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

export default RequestScreen;
