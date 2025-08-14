'use client'

import { useQuery } from 'convex/react'
import { useConvexAuth } from 'convex/react'
import { api } from '../../convex/_generated/api'

export const usePostHogUser = () => {
  const { isAuthenticated } = useConvexAuth()

  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  )

  return {
    isAuthenticated,
    user,
    isLoading: user === undefined && isAuthenticated,
  }
}
