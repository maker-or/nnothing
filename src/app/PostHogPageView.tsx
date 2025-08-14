'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { usePostHog } from 'posthog-js/react'

// 👉 Import the necessary Convex hooks
import { usePostHogUser } from '../hooks/usePostHogUser'

export default function PostHogPageView(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const posthog = usePostHog()

  // 👉 Add the hooks into the component
  const { isAuthenticated, user, isLoading } = usePostHogUser()

  // Track pageviews
  useEffect(() => {
    if (pathname && posthog) {
      let url = window.origin + pathname
      if (searchParams.toString()) {
        url = url + `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        $current_url: url,
      })
    }
  }, [pathname, searchParams, posthog])

  useEffect(() => {
    // 👉 Check the sign-in status and identify the user if they aren't already
    if (posthog && isAuthenticated && user && !isLoading && !posthog._isIdentified()) {
      // 👉 Identify the user with Convex user data (from Clerk identity)
      posthog.identify(user.id, {
        email: user.email || '',
        name: user.name || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        emailVerified: user.emailVerified || false,
        createdAt: user.createdAt,
        authenticated: true,
        userImage: user.image || '',
        clerkId: user.clerkId,
      })
    }
  }, [posthog, isAuthenticated, user, isLoading])

  return null
}
