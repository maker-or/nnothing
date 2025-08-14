'use client'

import { usePostHog } from 'posthog-js/react'
import { usePostHogUser } from '../hooks/usePostHogUser'

export default function PostHogTest() {
  const posthog = usePostHog()
  const { isAuthenticated, user, isLoading } = usePostHogUser()

  const testPageView = () => {
    if (posthog) {
      posthog.capture('test_pageview', {
        page: 'test-page',
        timestamp: new Date().toISOString(),
      })
      alert('Test pageview event sent to PostHog!')
    } else {
      alert('PostHog not initialized!')
    }
  }

  const testCustomEvent = () => {
    if (posthog) {
      posthog.capture('test_custom_event', {
        button_clicked: 'custom_test_button',
        authenticated: isAuthenticated,
        user_id: user?.id,
        user_email: user?.email,
        timestamp: new Date().toISOString(),
      })
      alert('Test custom event sent to PostHog!')
    } else {
      alert('PostHog not initialized!')
    }
  }

  const testIdentify = () => {
    if (posthog && isAuthenticated && user && !isLoading) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        authenticated: true,
        test_identify: true,
        createdAt: user.createdAt,
        userImage: user.image,
      })
      alert('User identified in PostHog!')
    } else if (!posthog) {
      alert('PostHog not initialized!')
    } else if (!isAuthenticated) {
      alert('User not authenticated!')
    } else if (isLoading) {
      alert('User data still loading!')
    } else if (!user) {
      alert('User data not available!')
    }
  }

  const testFeatureFlag = () => {
    if (posthog) {
      const flagValue = posthog.getFeatureFlag('test-flag')
      alert(`Feature flag 'test-flag' value: ${flagValue}`)
    } else {
      alert('PostHog not initialized!')
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-lg space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">PostHog Test</h2>

      <div className="space-y-2">
        <p className="text-sm text-gray-600">
          PostHog Status: {posthog ? '✅ Initialized' : '❌ Not Initialized'}
        </p>
        <p className="text-sm text-gray-600">
          User Status: {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
        </p>
        {isAuthenticated && (
          <div className="text-sm text-gray-600 space-y-1">
            <p>Status: Authenticated via Convex</p>
            {user && (
              <>
                <p>User ID: {user.id}</p>
                <p>Email: {user.email}</p>
                <p>Name: {user.name}</p>
                <p>Email Verified: {user.emailVerified ? '✅' : '❌'}</p>
              </>
            )}
            {isLoading && <p>Loading user data...</p>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3">
        <button
          onClick={testPageView}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Test PageView Event
        </button>

        <button
          onClick={testCustomEvent}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
        >
          Test Custom Event
        </button>

        <button
          onClick={testIdentify}
          className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          disabled={!isAuthenticated || isLoading || !user}
        >
          Test User Identify
        </button>

        <button
          onClick={testFeatureFlag}
          className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
        >
          Test Feature Flag
        </button>
      </div>

      <div className="mt-4 p-3 bg-gray-100 rounded">
        <h3 className="font-semibold text-sm mb-2">Instructions:</h3>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Click buttons to test PostHog events</li>
          <li>• Check your PostHog dashboard for events</li>
          <li>• Open browser dev tools to see any errors</li>
          <li>• Network tab should show requests to /ingest/</li>
        </ul>
      </div>
    </div>
  )
}
