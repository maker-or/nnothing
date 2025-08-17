'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { ArrowRightIcon, Warning } from '@phosphor-icons/react';
import IntroScreen from '../onboarding/screens/IntroScreen';
// import PreferencesScreen from '../onboarding/screens/PreferencesScreen';
import RequestScreen from '../onboarding/screens/RequestScreen';
import KnowledgeScreen from '../onboarding/screens/KnowledgeScreen';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

const OnboardingModal = ({ isOpen, onComplete }: OnboardingModalProps) => {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [isAccepted, setIsAccepted] = useState(false);
  const [preferencesAcknowledged, setPreferencesAcknowledged] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const { user } = useUser();

  // Debug state changes
  useEffect(() => {
    console.log('OnboardingModal state:', {
      currentScreen,
      preferencesAcknowledged,
      isAccepted,
      canProceed: (() => {
        if (currentScreen === 1) {
          return preferencesAcknowledged;
        } else if (currentScreen === screens.length - 1) {
          return isAccepted;
        } else {
          return true;
        }
      })()
    });
  }, [currentScreen, preferencesAcknowledged, isAccepted]);

  const screens = [
    { component: IntroScreen, title: "Introducing Learn Mode" },
    // { component: PreferencesScreen, title: "Preferred prompt style" },
    { component: RequestScreen, title: "Small Request" },
    { component: KnowledgeScreen, title: "Knowledge library" },
  ];

  const handleNext = async () => {
    if (currentScreen < screens.length - 1) {
      setError(null); // Clear any previous errors when navigating
      setCurrentScreen(currentScreen + 1);
    } else if (currentScreen === screens.length - 1 && isAccepted) {
      await completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    setIsCompleting(true);
    setError(null);

    try {
      await user?.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          onboardingComplete: true,
        },
      });

      // Small delay to ensure the update is processed
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
      setError('Failed to complete onboarding. Please try again.');
      setIsCompleting(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await completeOnboarding();
    setIsRetrying(false);
  };

  const handleBack = () => {
    if (currentScreen > 0) {
      setError(null); // Clear any errors when navigating back
      // Reset the acknowledgment states when going back
      if (currentScreen === 2) {
        setPreferencesAcknowledged(false);
      } else if (currentScreen === screens.length) {
        setIsAccepted(false);
      }
      setCurrentScreen(currentScreen - 1);
    }
  };

  const canProceed = (() => {
    if (currentScreen === 1) {
      // Preferences screen - requires acknowledgment
      return preferencesAcknowledged;
    } else if (currentScreen === screens.length - 1) {
      // Final screen - requires acceptance
      return isAccepted;
    } else {
      // All other screens can proceed
      return true;
    }
  })();

  if (!isOpen) return null;

  const CurrentScreenComponent = screens[currentScreen].component;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Noise overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '256px 256px',
        }}
      />

      {/* Modal container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 w-full max-w-4xl mx-4"
      >
        {/* Grid overlay */}
        <div className="pointer-events-none absolute inset-0">
          {/* Vertical lines */}
          <div className="absolute top-0 left-[20%] h-full w-px bg-white/20" />
          <div className="absolute top-0 left-[80%] h-full w-px bg-white/20" />
          {/* Horizontal lines */}
          <div className="absolute top-[10%] left-[20%] h-px w-[60%] bg-white/20" />
          <div className="absolute top-[90%] left-[20%] h-px w-[60%] bg-white/20" />
          {/* Corner circles */}
          <div className="absolute top-[10%] left-[20%] h-2 w-2 bg-white/60 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-[10%] left-[80%] h-2 w-2 bg-white/60 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-[90%] left-[20%] h-2 w-2 bg-white/60 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-[90%] left-[80%] h-2 w-2 bg-white/60 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
        </div>

        {/* Content area */}
        <div className="relative bg-[#1a1a1a]  border border-white/10 w-[60svw] rounded-2xl min-h-[70svh] flex flex-col">
          {/* Progress indicator */}
          <div className="flex justify-center py-6">
            <div className="flex space-x-3">
              {screens.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-12 rounded-full transition-all duration-300 ${
                    index <= currentScreen ? 'bg-white' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Screen content */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentScreen}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                <CurrentScreenComponent
                  onAcceptChange={
                    currentScreen === 1 ? (value) => {
                      console.log('Preferences acknowledged:', value);
                      setPreferencesAcknowledged(value);
                    } :
                    currentScreen === screens.length - 1 ? (value) => {
                      console.log('Final acceptance:', value);
                      setIsAccepted(value);
                    } :
                    undefined
                  }
                  isAccepted={
                    currentScreen === 1 ? preferencesAcknowledged :
                    currentScreen === screens.length - 1 ? isAccepted :
                    false
                  }
                  onNext={handleNext}
                  onBack={handleBack}
                  canGoBack={currentScreen > 0}
                  canGoNext={canProceed}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Error Display - positioned absolutely */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-4 left-4 right-4 bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center space-x-3 z-10"
            >
              <Warning size={20} className="text-red-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-red-400 text-sm">{error}</p>
                {currentScreen === screens.length - 1 && (
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="mt-2 text-red-300 hover:text-red-200 text-sm underline disabled:opacity-50"
                  >
                    {isRetrying ? 'Retrying...' : 'Try again'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default OnboardingModal;
