// convex/users.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Return user data from Clerk identity
    const firstName = String(identity.given_name || "");
    const lastName = String(identity.family_name || "");
    const fullName = identity.name ? String(identity.name) : (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || "User");

    return {
      id: String(identity.subject),
      name: fullName,
      email: String(identity.email || ""),
      emailVerified: Boolean(identity.email_verified),
      image: identity.picture ? String(identity.picture) : null,
      createdAt: identity.iat ? (identity.iat as number) * 1000 : Date.now(),
      clerkId: String(identity.subject),
      firstName,
      lastName,
    };
  },
});

// Legacy functions - commented out due to schema mismatch
// TODO: Implement these with proper Better Auth user table integration
//
// export const updatePrompt = mutation({
//   args: { prompt: v.string() },
//   handler: async (ctx, args) => {
//     const userId = await ctx.auth.getUserIdentity();
//     if (!userId) throw new Error("Not authenticated");
//     await ctx.db.patch(userId, { prompt: args.prompt });
//   },
// });
//
// export const getPrompt = query({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await ctx.auth.getUserIdentity();
//     if (!userId) throw new Error("Not authenticated");
//
//     const user =userId.subject;
//     return user?.prompt ?? "";
//   },
// });
//
// export const getByOK = query({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await ctx.auth.getUserIdentity();
//     if (!userId) throw new Error("Not authenticated");
//     const user = await ctx.db.get(userId.subject);
//     return user?.encryptedApiKey ?? "";
//   },
// });
//
// export const setOnboardingComplete = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await ctx.auth.getUserIdentity();
//     if (!userId) throw new Error("Not authenticated");
//     await ctx.db.patch(userId, { onboardingComplete: true });
//   },
// });
