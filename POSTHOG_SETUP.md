# PostHog Setup Guide

This document explains how PostHog analytics is integrated into your Next.js application using Convex for user authentication.

## Overview

PostHog is configured to:
- Track page views automatically
- Identify users with Convex user data
- Capture custom events
- Work with your existing Convex + Better Auth setup
- Proxy requests through `/ingest` to avoid ad blockers

## Configuration Files

### 1. Environment Variables

Add to your `.env.local` file:
```env
NEXT_PUBLIC_POSTHOG_KEY=phc_your_posthog_project_key_here
```

### 2. Core Setup Files

- **`src/app/providers.tsx`** - PostHog provider with client-side initialization
- **`instrumentation.ts`** - Server-side PostHog setup
- **`src/app/PostHogPageView.tsx`** - Automatic pageview tracking + user identification
- **`src/hooks/usePostHogUser.ts`** - Custom hook to get user data from Convex
- **`convex/users.ts`** - Convex query to fetch current user information

### 3. Next.js Configuration

Your `next.config.ts` already includes the necessary rewrites to proxy PostHog requests:

```typescript
async rewrites() {
  return [
    {
      source: "/ingest/static/:path*",
      destination: "https://us-assets.i.posthog.com/static/:path*",
    },
    {
      source: "/ingest/:path*",
      destination: "https://us.i.posthog.com/:path*",
    },
    {
      source: "/ingest/flags",
      destination: "https://us.posthog.com/flags",
    },
  ];
}
```

## How It Works

### User Authentication Flow

1. **Convex Authentication**: Users authenticate through your existing Convex + Better Auth setup
2. **User Data Fetching**: `usePostHogUser` hook fetches user details from Convex's `user` table
3. **PostHog Identification**: When a user is authenticated and user data is loaded, PostHog automatically identifies them with:
   - User ID (from Convex)
   - Email address
   - Display name
   - Email verification status
   - Account creation date
   - Profile image (if available)

### Automatic Tracking

- **Page Views**: Every page navigation is automatically tracked
- **User Sessions**: Users are identified when they sign in
- **Custom Events**: You can add custom event tracking anywhere in your app

## Testing PostHog Integration

### Debug Page

Visit `/debug-posthog` to access the PostHog test interface. This page allows you to:

- Check if PostHog is properly initialized
- Test custom event tracking
- Verify user identification
- Test feature flags

### Browser Developer Tools

1. Open Network tab in browser dev tools
2. Navigate around your app
3. Look for requests to `/ingest/` - these are PostHog events
4. Check Console for any PostHog-related errors

### PostHog Dashboard

1. Log into your PostHog dashboard
2. Go to "Live Events" to see events in real-time
3. Check "Persons" to see identified users
4. Review "Insights" for analytics data

## Usage Examples

### Basic Event Tracking

```typescript
import { usePostHog } from 'posthog-js/react'

function MyComponent() {
  const posthog = usePostHog()

  const handleButtonClick = () => {
    posthog?.capture('button_clicked', {
      button_name: 'my_button',
      page: 'home',
      timestamp: new Date().toISOString(),
    })
  }

  return <button onClick={handleButtonClick}>Click me</button>
}
```

### User Properties

```typescript
import { usePostHogUser } from '../hooks/usePostHogUser'

function MyComponent() {
  const { user, isAuthenticated } = usePostHogUser()
  const posthog = usePostHog()

  const handleAction = () => {
    if (posthog && isAuthenticated && user) {
      posthog.capture('user_action', {
        user_id: user.id,
        user_email: user.email,
        action: 'performed_task',
      })
    }
  }
}
```

### Feature Flags

```typescript
import { usePostHog } from 'posthog-js/react'

function MyComponent() {
  const posthog = usePostHog()
  const isNewFeatureEnabled = posthog?.getFeatureFlag('new_feature')

  return (
    <div>
      {isNewFeatureEnabled ? (
        <NewFeatureComponent />
      ) : (
        <OldFeatureComponent />
      )}
    </div>
  )
}
```

## Data Privacy & Compliance

### GDPR Compliance

PostHog is configured to respect user privacy:

- Users are only identified when authenticated
- You can implement opt-out functionality using PostHog's privacy controls
- Data is processed according to PostHog's privacy policy

### Data Collection

We collect:
- Page views and navigation patterns
- User interactions (button clicks, form submissions)
- User account information (email, name, verification status)
- Session information
- Custom events you define

## Troubleshooting

### Common Issues

1. **"Failed to fetch" errors**
   - Check that your `NEXT_PUBLIC_POSTHOG_KEY` is set correctly
   - Verify the proxy configuration in `next.config.ts`
   - Make sure you're using the correct PostHog region (US vs EU)

2. **Events not appearing in PostHog**
   - Check browser network tab for failed `/ingest` requests
   - Verify PostHog key is correct
   - Check for console errors

3. **User identification not working**
   - Ensure user is authenticated with Convex
   - Check that `convex/users.ts` query is working
   - Verify user data is being fetched correctly

4. **TypeScript errors**
   - Make sure all PostHog dependencies are installed
   - Check that `usePostHogUser` hook is imported correctly

### Debug Checklist

- [ ] PostHog key is set in environment variables
- [ ] User can access `/debug-posthog` page
- [ ] Network requests to `/ingest/` are successful
- [ ] User authentication with Convex is working
- [ ] Events appear in PostHog dashboard
- [ ] User identification is working in PostHog "Persons" tab

## Integration with Your Convex App

This PostHog setup is designed to work seamlessly with your existing:

- **Convex authentication** - Uses `useConvexAuth()` for auth state
- **Better Auth user system** - Fetches user data from Convex `user` table
- **Clerk integration** - Works alongside your Clerk setup
- **Custom auth hooks** - Compatible with `useAuthMutation` and `useAuthAction`

The integration automatically handles the transition from your current Clerk-based user identification to the new Better Auth system.

## Security Notes

- PostHog key is exposed to the client (this is expected and safe)
- Server-side PostHog instance uses the same key but with different permissions
- All requests are proxied through your domain to improve deliverability
- User data is only sent to PostHog when users are authenticated

## Support

If you encounter issues:

1. Check the debug page at `/debug-posthog`
2. Review browser console and network tabs
3. Verify environment variables are set correctly
4. Check PostHog dashboard for incoming data
5. Review this documentation for configuration steps

For PostHog-specific issues, refer to the [PostHog documentation](https://posthog.com/docs).
