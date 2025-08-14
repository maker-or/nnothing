'use client'

import PostHogTest from '../../components/PostHogTest'

export default function DebugPostHogPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8">PostHog Debug Page</h1>
        <PostHogTest />
      </div>
    </div>
  )
}
