# Migration from PostHog LLM Observability to Langfuse

This document outlines the migration from PostHog LLM observability to Langfuse for AI-specific tracing while maintaining PostHog for general platform analytics.

## Overview

We have successfully migrated the three core AI files:
- `convex/agent.ts` - AI agent with tools
- `convex/context.ts` - Context gathering for course creation
- `convex/ai.ts` - Chat completion streaming

## Key Changes

### 1. Dependencies Updated

**Removed:**
- `@posthog/ai` - PostHog AI SDK for LLM tracing

**Added:**
- `langfuse` - Core Langfuse SDK for LLM observability

### 2. Environment Variables

Add these new environment variables to your `.env` file:

```env
# Langfuse Configuration
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_BASEURL="https://cloud.langfuse.com"  # EU region
# LANGFUSE_BASEURL="https://us.cloud.langfuse.com"  # US region

# Keep existing PostHog variables for platform analytics
NEXT_PUBLIC_POSTHOG_KEY="phc_..."
NEXT_PUBLIC_POSTHOG_HOST="https://us.i.posthog.com"
```

### 3. Migration Details by File

#### `convex/agent.ts`
- **Before:** Used `withTracing()` wrapper from PostHog AI SDK
- **After:** Direct Langfuse SDK integration with traces and spans
- **Key Features:**
  - Tool execution tracking with Langfuse spans
  - Stage processing with individual traces per stage
  - Error tracking via trace events
  - Maintains correlation IDs for multi-stage processes

#### `convex/context.ts`
- **Before:** PostHog AI SDK tracing with events
- **After:** Langfuse traces and generations
- **Key Features:**
  - Single trace for entire context gathering session
  - Generation tracking for LLM calls
  - Validation error tracking via events
  - Run ID correlation for downstream processes

#### `convex/ai.ts`
- **Before:** PostHog AI SDK for LLM tracing + PostHog events
- **After:** Langfuse for LLM tracing + PostHog for platform analytics
- **Key Features:**
  - Dual observability: Langfuse for AI, PostHog for platform
  - Streaming completion tracking
  - Token usage monitoring
  - Error handling with both systems

## Integration with Vercel AI SDK

All files now include `experimental_telemetry` configuration for Vercel AI SDK integration:

```typescript
experimental_telemetry: {
  isEnabled: true,
  functionId: 'function-name',
  metadata: {
    stage_title: stage.title,
    userId: userId,
    // other metadata
  },
}
```

## Benefits of the Migration

### 1. **Specialized AI Observability**
- Purpose-built for LLM applications
- Better visualization of AI workflows
- Advanced prompt management capabilities
- Structured data capture for AI-specific metrics

### 2. **Improved Debugging**
- Individual traces for each stage processing
- Input/output tracking for each AI operation
- Error correlation via trace events
- Tool execution visibility through spans

### 3. **Better Performance Monitoring**
- Token usage tracking through generations
- Model performance metrics
- Cost optimization insights
- Usage pattern analysis

### 4. **Maintained Platform Analytics**
- PostHog continues to track user behavior and platform metrics
- Clear separation of concerns between AI observability and platform analytics
- Unified user experience tracking

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│    Langfuse     │    │    PostHog      │
│  (AI Tracing)   │    │  (Platform)     │
├─────────────────┤    ├─────────────────┤
│ • LLM calls     │    │ • User events   │
│ • Tool spans    │    │ • Chat metrics  │
│ • Generations   │    │ • Performance   │
│ • Stage traces  │    │ • Business KPIs │
└─────────────────┘    └─────────────────┘
```

## Next Steps

1. **Environment Setup:**
   - Add Langfuse environment variables
   - Create a Langfuse project and get API keys

2. **Monitoring:**
   - Verify traces appear in Langfuse dashboard
   - Check that PostHog continues to receive platform events

3. **Optimization:**
   - Review trace structure for insights
   - Set up alerts for AI-related errors
   - Configure cost tracking and usage limits

## Verification Checklist

- [ ] Langfuse environment variables configured
- [ ] AI operations create traces in Langfuse
- [ ] Tool executions are tracked as spans
- [ ] Error events are captured via trace events
- [ ] PostHog continues to receive platform analytics
- [ ] No breaking changes to existing functionality
- [ ] Performance impact is minimal

## Support

For issues with this migration:
1. Check environment variables are correctly set
2. Verify Langfuse project permissions
3. Review console logs for connection errors
4. Ensure both PostHog and Langfuse clients are properly initialized
