import { defineSchema, defineTable } from 'convex/server';
import { StreamIdValidator } from "@convex-dev/persistent-text-streaming";
import { v } from 'convex/values';

// Better Auth schema is handled by the component

const applicationTables = {
  chats: defineTable({
    title: v.string(),
    userId: v.string(), // by clrek
    model: v.string(),
    systemPrompt: v.optional(v.string()),
    isShared: v.optional(v.boolean()),
    shareId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),

    pinned: v.boolean(),
  })
    .index('by_user', ['userId'])
    .index('by_share_id', ['shareId'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['userId'],
    }),
  Course: defineTable({
    prompt: v.string(),
    userId: v.string(), // by clrek
    createdAt: v.number(),
    stages: v.array(
      v.object({
        title: v.string(),
        purpose: v.string(),
        include: v.array(v.string()),
        outcome: v.string(),
        discussion_prompt: v.string(),
      })
    ),
  })
    .index('by_user', ['userId'])
    .searchIndex('search_title', {
      searchField: 'prompt',
      filterFields: ['userId'],
    }),
  Stage: defineTable({
    title: v.string(),
    userId: v.string(), // from Clerk
    courseId: v.id('Course'),
    slides: v.array(
      v.object({
        name: v.string(),
        title: v.string(),
        subTitles: v.optional(v.string()),
        svg: v.optional(v.string()),
        content: v.string(),
        links: v.optional(v.array(v.string())),
        youtubeSearchText: v.optional(v.string()),
        code: v.optional(
          v.object({
            language: v.string(),
            content: v.string(),
          })
        ),
        tables: v.optional(v.string()),
        bulletPoints: v.optional(v.array(v.string())),
        flashcardData: v.optional(
          v.array(
            v.object({
              question: v.string(),
              answer: v.string(),
            })
          )
        ),
        testQuestions: v.optional(
          v.array(
            v.object({
              question: v.string(),
              options: v.array(v.string()),
              answer: v.string(),
            })
          )
        ),
        type: v.string(), // If you want enum: v.union([v.literal("markdown"), v.literal("code"), ...])
      })
    ),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_course', ['courseId'])
    .searchIndex('search_title', {
      searchField: 'title',
      filterFields: ['userId'],
    }),


  // new tabe for the organisations collages
  organizations: defineTable({
    name: v.string(),
    domain: v.string(), // email domain like "university.edu"
    invitationToken: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_domain", ["domain"]),
  // new table for the mapping between users and organisation
    user_organizations: defineTable({
    userId: v.string(), // Better Auth uses string IDs
    organizationId: v.id("organizations"),
    role: v.union(
      v.literal("admin"),
      v.literal("student"),
      v.literal("teacher")
    ),
    joinedAt: v.number(),
  })
    .index("by_organizationId", ["organizationId"])
    .index("by_userId", ["userId"]),

  // to store and verify the OTPs Via Emails
  emailOtps: defineTable({
    email: v.string(),
    otp: v.string(), // encrypted
    expiresAt: v.number(),
    attempts: v.number(),
    type: v.union(v.literal("signin"), v.literal("signup")),
    used: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_expiry", ["expiresAt"]),

  // Better Auth tables
  user: defineTable({
    name: v.string(),
    email: v.string(),
    emailVerified: v.boolean(),
    image: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"]),

  session: defineTable({
    expiresAt: v.number(),
    token: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    userId: v.string(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  account: defineTable({
    accountId: v.string(),
    providerId: v.string(),
    userId: v.string(),
    accessToken: v.optional(v.string()),
    refreshToken: v.optional(v.string()),
    idToken: v.optional(v.string()),
    accessTokenExpiresAt: v.optional(v.number()),
    refreshTokenExpiresAt: v.optional(v.number()),
    scope: v.optional(v.string()),
    password: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_provider", ["providerId", "accountId"]),

  verification: defineTable({
    identifier: v.string(),
    value: v.string(),
    type: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_identifier", ["identifier"])
    .index("by_value", ["value"])
    .index("by_expiry", ["expiresAt"]),



  messages: defineTable({
    chatId: v.id('chats'),
    userId: v.string(), // by clrek,
    role: v.union(
      v.literal('user'),
      v.literal('assistant'),
      v.literal('system')
    ),
    content: v.string(),
    parentId: v.optional(v.id('messages')),
    model: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    branchId: v.optional(v.id('branches')),
    createdAt: v.number(),
    webSearchUsed: v.optional(v.boolean()),
    isProcessingComplete: v.optional(v.boolean()),
  })
    .index('by_chat', ['chatId'])
    .index('by_chat_and_parent', ['chatId', 'parentId'])
    .index('by_parent', ['parentId'])
    .index('by_branch', ['branchId'])
    .index('by_userId', ['userId']),

  streamingSessions: defineTable({
    chatId: v.id('chats'),
    messageId: v.id('messages'),
    userId: v.string(), // by clrek,
    isActive: v.boolean(),
    lastChunk: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_chat', ['chatId'])
    .index('by_message', ['messageId'])
    .index('by_user', ['userId']),

  // New tables for advanced features

  branches: defineTable({
    chatId: v.id('chats'),
    fromMessageId: v.id('messages'),
    name: v.string(),
    isActive: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_chat', ['chatId'])
    .index('by_message', ['fromMessageId']),

  resumableStreams: defineTable({
    chatId: v.id('chats'),
    messageId: v.id('messages'),
    userId: v.string(),
    model: v.string(),
    messages: v.array(
      v.object({
        role: v.union(
          v.literal('user'),
          v.literal('assistant'),
          v.literal('system')
        ),
        content: v.string(),
      })
    ),
    checkpoint: v.string(),
    isActive: v.boolean(),
    isPaused: v.boolean(),
    progress: v.number(),
    totalTokens: v.number(),
    createdAt: v.number(),
    lastResumed: v.number(),
    lastPaused: v.optional(v.number()),
    lastUpdated: v.optional(v.number()),
    completedAt: v.optional(v.number()),
  })
    .index('by_chat', ['chatId'])
    .index('by_user', ['userId'])
    .index('by_message', ['messageId']),
};

export default defineSchema({
  ...applicationTables,
});
