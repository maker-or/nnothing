import { PostHog } from 'posthog-node'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const posthog = new PostHog(
      process.env.NEXT_PUBLIC_POSTHOG_KEY!,
      {
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      }
    )

    // You can add server-side event tracking here if needed
    // For example:
    // posthog.capture('server_started', { timestamp: new Date().toISOString() })
  }
}
