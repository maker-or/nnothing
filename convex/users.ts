// convex/users.ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    // Get user from Better Auth user table
    const user = await ctx.db
      .query("user")
      .filter((q) => q.eq(q.field("email"), identity.email))
      .first();

    if (!user) return null;

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
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
