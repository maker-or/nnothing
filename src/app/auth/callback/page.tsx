// app/auth/callback/page.tsx
import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';

export default function OAuthCallback() {
  return (
    <AuthenticateWithRedirectCallback
      afterSignUpUrl="/learning"   // new users go here next
      afterSignInUrl="/learning"   // existing users go here next
      signUpFallbackRedirectUrl="/learning"
    />
  );
}
