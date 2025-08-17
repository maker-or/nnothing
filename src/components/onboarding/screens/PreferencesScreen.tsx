'use client';

interface PreferencesScreenProps {
  onAcceptChange?: (accepted: boolean) => void;
  isAccepted?: boolean;
  onNext?: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  canGoNext?: boolean;
}

const PreferencesScreen = ({
  onAcceptChange,
  isAccepted,
  onNext,
  onBack,
  canGoBack = true,
  canGoNext = true
}: PreferencesScreenProps) => {
  const examples = [
    {
      label: 'What you want to learn',
      color: 'bg-orange-500',
      content: 'Modern NLP with the Transformer Architecture'
    },
    {
      label: 'Any specific topics',
      color: 'bg-white',
      content:
        "- A brief review of the limitations of RNNs/LSTMs to set the stage.\n- A deep dive into the core components: Self-Attention (Query, Key, Value), Multi-Head Attention, and Positional Encoding.\n- A clear architectural breakdown of the Encoder-only (like BERT), Decoder-only (like GPT), and the full Encoder-Decoder models."
    },
    {
      label: `previous understanding`,
      color: 'bg-blue-500',
      content:
        "I am a student, who is preparing for my exam, as a beginner, i don't have any pervious knowledge on any of these topics"
    },
    {
      label: 'Learning style',
      color: 'bg-green-500',
      content:
        'I need to understand the theory first to build intuition, then immediately apply it with hands-on code. A mix of clear diagrams for the architecture and'
    }
  ];

  return (
    <div className="h-[50svh]  p-3 w-full flex items-center justify-center px-6">
      {/* Card */}
      <div className=" overflow-auto  h-[90svh] w-full  bg-[#2b2b2e] border border-white/10 rounded-[24px] shadow-2xl px-2 ">
        {/* Title */}
        <div className="mb-8 md:mb-10">
          <h1 className="text-left p-3 text-4xl md:text-6xl font-light text-white">
            Preferred <span className="font-serif italic">prompt style</span>
          </h1>
          <p className="mt-3 text-white/60 text-base md:text-lg font-light">
            Here are examples of how you can structure your learning requests
          </p>
        </div>

        {/* Examples */}
        <div className="space-y-6 md:space-y-8 items-center justify-center">
          {examples.map((example, index) => (
            <div key={index} className="flex items-center space-x-6">
              {/* Left label column */}
              <div className="min-w-[180px] md:min-w-[220px] text-left md:text-right pt-1">
                <div className="text-white/60 text-sm md:text-base leading-tight font-light">
                  {example.label}
                </div>
              </div>

              {/* Content card with color bar */}
              <div className="relative flex-1  rounded-2xl p-2 md:p-7 pl-7 md:pl-10">
                <span
                  className={`absolute left-0 top-0 md:top-6 w-1.5 md:w-2  md:h-full rounded-full ${example.color}`}
                />
                <div className="text-white/90 whitespace-pre-line leading-relaxed text-base md:text-lg font-light">
                  {example.content}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom helper + acknowledgment */}


        {/* Navigation arrows (bottom-right inside card) */}
        <div className=" right-6 bottom-6 md:right-8 md:bottom-8 flex space-x-3 md:space-x-4">
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

            className={`w-12 h-12 md:w-14 md:h-14 rounded-[12px] flex items-center justify-center shadow-lg transition-all duration-200
 bg-white hover:bg-white/90 cursor-pointer
            }`}
            aria-label="Next"
          >
            <svg
              className={`w-6 h-6 md:w-7 md:h-7 text-black`}
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

export default PreferencesScreen;
