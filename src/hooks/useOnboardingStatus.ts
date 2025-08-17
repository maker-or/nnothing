'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export const useOnboardingStatus = () => {
  const { user, isLoaded } = useUser();
  const [isOnboardingComplete, setIsOnboardingComplete] = useState<boolean | null>(null);

  useEffect(() => {
    if (isLoaded && user) {
      // Check if onboarding is complete from Clerk's public metadata
      const onboardingComplete = user.unsafeMetadata?.onboardingComplete as boolean;
      setIsOnboardingComplete(!!onboardingComplete);
    } else if (isLoaded && !user) {
      // User is not authenticated
      setIsOnboardingComplete(null);
    }
  }, [user, isLoaded]);

  const markOnboardingComplete = async () => {
    if (!user) return;

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          onboardingComplete: true,
        },
      });
      setIsOnboardingComplete(true);
    } catch (error) {
      console.error('Failed to update onboarding status:', error);
      throw error;
    }
  };

  return {
    isOnboardingComplete,
    isLoading: !isLoaded || isOnboardingComplete === null,
    markOnboardingComplete,
    isAuthenticated: !!user,
  };
};
