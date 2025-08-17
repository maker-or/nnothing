'use client';

import { useState } from 'react';
import AiHome from '../../components/AiHome';
import OnboardingModal from '../../components/onboarding/OnboardingModal';
import { useOnboardingStatus } from '../../hooks/useOnboardingStatus';

const Page = () => {
  const { isOnboardingComplete, isLoading, isAuthenticated } = useOnboardingStatus();


  // Show loading state while checking authentication and onboarding status
  if (isLoading) {
    return (
      <main className="h-[100svh] w-[100svw] bg-black flex items-center justify-center">
        <div className="text-white text-lg">Loading...</div>
      </main>
    );
  }

  // If user is not authenticated, this shouldn't happen due to routing logic
  if (!isAuthenticated) {
    return (
      <main className="h-[100svh] w-[100svw] bg-black flex items-center justify-center">
        <div className="text-white text-lg">Please sign in</div>
      </main>
    );
  }

  // Show onboarding modal for first-time users
  const shouldShowOnboarding = !isOnboardingComplete;

  const handleOnboardingComplete = () => {
    // The modal handles updating the Clerk metadata
    // The useOnboardingStatus hook will automatically update isOnboardingComplete
  };

  return (
    <main>
      <AiHome />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={shouldShowOnboarding}
        onComplete={handleOnboardingComplete}
      />
    </main>
  );
};

export default Page;
