import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const signInRoutes = ["/select"];

export default clerkMiddleware(async (auth, request) => {
  const { userId } = await auth();
  const { pathname, origin } = request.nextUrl;

  const isSignInRoute = signInRoutes.includes(pathname);

  // Not signed in and trying to access a protected route -> redirect to /select
  if (!userId && !isSignInRoute) {
    return NextResponse.redirect(new URL("/select", origin));
  }

  // Signed in and visiting / or a sign-in route -> redirect to /learning
  if (userId && (isSignInRoute || pathname === "/")) {
    return NextResponse.redirect(new URL("/learning", origin));
  }

  return NextResponse.next();
});

export const config = {
  // Run middleware on all routes except static assets and api routes
  matcher: ["/((?!.*\\..*|_next|api).*)", "/", "/trpc(.*)"],
};
