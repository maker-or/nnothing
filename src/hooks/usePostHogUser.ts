'use client'

import { useQuery } from 'convex/react'
import { useConvexAuth } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Hook to get user data from Convex for PostHog identification
 *
 * Returns user data extracted from Clerk identity via Convex
 */
export const usePostHogUser = () => {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth()

  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  )

  return {
    isAuthenticated,
    user,
    isLoading: (user === undefined && isAuthenticated) || authLoading,
  }
}
