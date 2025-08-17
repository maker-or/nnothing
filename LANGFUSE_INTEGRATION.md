# Langfuse Integration Guide

## Overview

This document outlines the comprehensive Langfuse integration implemented in the SphereAI agent system. The integration provides complete observability, monitoring, and debugging capabilities for the AI-powered course generation pipeline.

## Architecture

The system consists of two main components with full Langfuse tracking:

1. **Context Gathering** (`context.ts`) - Initial course structure generation
2. **Agent Execution** (`agent.ts`) - Detailed content generation with tool usage

## Key Features

### 🔍 Complete Request Tracing
- **Run ID Correlation**: Every request gets a unique `runId` that correlates context gathering with agent execution
- **User Tracking**: All traces are associated with authenticated users
- **Hierarchical Traces**: Parent-child relationships between main operations and sub-tasks

### 🛠️ Tool Usage Monitoring
- **Tool Tracing Wrapper**: Every tool call is automatically wrapped with Langfuse tracking
- **Input/Output Logging**: Complete visibility into tool arguments and results
- **Error Handling**: Tool failures are captured with full context
- **Performance Tracking**: Tool execution times and success rates

### 📊 Generation Tracking
- **Model Usage**: All AI model calls tracked with input/output/usage statistics
- **Token Consumption**: Detailed token usage tracking for cost monitoring
- **Stream Monitoring**: Real-time tracking of streaming responses
- **Synthesis Tracking**: Separate tracking for response synthesis when needed

### 🎯 Stage-Level Observability
- **Individual Stage Traces**: Each course stage gets its own trace
- **Content Generation**: Complete tracking of slide generation process
- **Validation Tracking**: Schema validation results and errors
- **Success Metrics**: Slides count, completion status, and quality metrics

## Implementation Details

### Context Gathering Integration

```typescript
// Trace Creation
const trace = langfuse.trace({
  name: 'context-gather',
  userId: userId,
  metadata: {
    run_id: runId,
    phase: 'contextgather',
    source: 'sphereai-agent',
    prompt_length: args.messages?.length ?? 0,
    messages: args.messages,
  },
});

// Generation Tracking
const generation = langfuse.generation({
  name: 'syllabus-generation',
  model: 'openai/gpt-oss-120b',
  input: {
    user_request: args.messages,
    system_prompt: `You are an expert AI curriculum designer...`,
  },
  traceId: trace.id,
  metadata: {
    run_id: runId,
    phase: 'contextgather',
    user_id: userId,
  },
});
```

### Agent Execution Integration

```typescript
// Main Agent Trace
const agentTrace = langfuse.trace({
  name: 'agent-execution',
  userId: modelCtx.userId,
  metadata: {
    ...baseProps,
    total_stages: course.course?.stages?.length || 0,
  },
});

// Stage-Level Traces (with parent relationship)
const stageTrace = langfuse.trace({
  name: `stage-${stage.title}`,
  userId: modelCtx.userId,
  parentObservationId: agentTrace.id, // 👈 Parent relationship
  metadata: {
    stage_title: stage.title,
    stage_purpose: stage.purpose,
    stage_topics: stage.include,
    stage_outcome: stage.outcome,
    ...baseProps,
  },
});
```

### Tool Tracing Wrapper

```typescript
function withToolTracing<TArgs extends Record<string, any>, TResult>(
  name: string,
  exec: ToolExec<TArgs, TResult>,
  langfuseClient: Langfuse,
  baseProps?: Record<string, any>
): ToolExec<TArgs, TResult> {
  return async (args: TArgs) => {
    const span = langfuseClient.span({
      name: `tool-${name}`,
      input: args,
      metadata: {
        ...baseProps,
        tool_name: name,
      },
    });

    try {
      const result = await exec(args);
      span.end({ output: result });
      return result;
    } catch (err: any) {
      span.end({
        output: {
          error_message: err?.message ?? 'Unknown error',
          error_name: err?.name,
        },
        level: "ERROR",
      });
      throw err;
    }
  };
}
```

## Tracked Events

### Context Gathering Events
- `context-gather` - Main trace for course structure generation
- `syllabus-generation` - AI generation for course outline
- `validation-error` - Schema validation failures
- `course-created` - Successful course creation
- `context-error` - Any errors during context gathering

### Agent Execution Events
- `agent-execution` - Main trace for content generation
- `stage-{title}` - Individual stage processing
- `stage-generation-{title}` - AI generation for stage content
- `tool-call-started` - Tool invocation begins
- `tool-call-completed` - Tool execution finished
- `stream-completed` - Streaming response finished
- `stream-error` - Streaming failures
- `synthesis-generation-{title}` - Response synthesis when needed
- `final-object-generation-{title}` - Final slide generation
- `stage-completed` - Stage successfully processed
- `stage-error` - Stage processing failures

## Monitoring Capabilities

### 🔄 Real-Time Monitoring
- **Live Stream Tracking**: Monitor AI responses as they generate
- **Tool Usage Patterns**: See which tools are used most frequently
- **Error Rates**: Track failure rates across different components
- **Performance Metrics**: Response times and bottlenecks

### 📈 Analytics & Insights
- **User Behavior**: Track what types of courses users request
- **Content Quality**: Monitor generated content validation rates
- **Cost Analysis**: Token usage and API costs per request
- **Success Rates**: Completion rates for different course types

### 🚨 Error Tracking
- **Complete Error Context**: Full error messages, stack traces, and user context
- **Failure Patterns**: Identify common failure points
- **Recovery Tracking**: Monitor synthesis fallback usage
- **Validation Issues**: Track schema validation problems

## Usage Examples

### Viewing Tool Usage
```
// In Langfuse Dashboard
Filter by: event_name = "tool-call-started"
Group by: tool_name
Metrics: Count, Success Rate, Average Duration
```

### Monitoring User Sessions
```
// Track complete user journey
Filter by: user_id = "specific_user"
Order by: timestamp
View: Full trace hierarchy
```

### Token Usage Analysis
```
// Monitor AI model costs
Filter by: event_name = "generation"
Metrics: Sum(usage.totalTokens), Avg(usage.inputTokens), Avg(usage.outputTokens)
Group by: model, user_id
```

### Performance Analysis
```
// Find slow stages
Filter by: trace_name contains "stage-"
Metrics: Duration > 30s
Group by: stage_title
```

### Error Investigation
```
// Debug specific failures
Filter by: level = "ERROR"
Include: error_message, stack_trace, user_context
Group by: error_name
```

## Configuration

### Environment Variables Required
```env
LANGFUSE_SECRET_KEY=your_secret_key
LANGFUSE_PUBLIC_KEY=your_public_key
LANGFUSE_BASEURL=https://cloud.langfuse.com  # or your self-hosted instance
```

### Validation
Before deploying, run the validation script:
```bash
npx tsx validate-langfuse.ts
```

This will test all integration components and verify connectivity.

### Initialization
```typescript
const langfuse = new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  baseUrl: process.env.LANGFUSE_BASEURL ?? "https://cloud.langfuse.com"
});
```

## Best Practices

### 1. Correlation IDs
- Always use `runId` to correlate related operations
- Include `userId` for user-specific tracking
- Add `courseId` for content-specific analysis

### 2. Structured Metadata
```typescript
const baseProps = {
  userId: modelCtx.userId,
  courseId: modelCtx.courseId,
  runId: runId,
  source: 'sphereai-agent',
};
```

### 3. Error Handling
- Always capture errors in traces and events
- Include full context (user request, stage info, etc.)
- Use appropriate log levels (ERROR, WARNING, INFO)

### 4. Data Flushing
```typescript
// Always flush at the end of operations
try {
  await langfuse.flushAsync();
  console.log("✅ Langfuse data flushed successfully");
} catch (flushError) {
  console.error("❌ Failed to flush Langfuse data:", flushError);
}
```

### 5. Performance Considerations
- Use spans for short operations (tool calls)
- Use generations for AI model calls
- Use traces for main workflows
- Include usage statistics when available

## Debugging Guide

### Common Issues

#### 1. Missing Traces
**Problem**: Traces not appearing in Langfuse
**Solution**:
- Check environment variables
- Ensure `flushAsync()` is called
- Verify network connectivity

#### 2. Broken Correlations
**Problem**: Related operations not linked
**Solution**:
- Verify `runId` is passed between components
- Check `parentObservationId` in child traces
- Ensure `traceId` is used in events/generations

#### 3. High Token Costs
**Problem**: Unexpected API usage
**Solution**:
- Monitor usage statistics in generations
- Track token consumption per request type
- Identify inefficient prompt patterns

### Debug Queries
```typescript
// Enable debug logging
console.log('Langfuse trace ID:', trace.id);
console.log('Run ID:', runId);
console.log('User ID:', userId);
```

## Future Enhancements

### Planned Features
1. **Custom Metrics**: Course quality scores, user satisfaction
2. **A/B Testing**: Track different prompt strategies
3. **Cost Optimization**: Automatic model routing based on complexity
4. **Quality Monitoring**: Content validation and improvement suggestions
5. **User Analytics**: Learning outcome tracking and recommendations

### Integration Opportunities
1. **PostHog Integration**: User behavior analytics
2. **Helicone Integration**: Advanced AI observability
3. **Custom Dashboards**: Business-specific metrics
4. **Alerting System**: Real-time failure notifications

## TypeScript Integration Notes

### Fixed Issues
The implementation correctly handles:

1. **Variable Declaration Order**: `modelCtx` is declared before usage
2. **Trace Update API**: Removed unsupported `level` property from trace updates
3. **Usage Property Names**: Updated to match AI SDK v5 interface:
   - `usage.inputTokens` (formerly `promptTokens`)
   - `usage.outputTokens` (formerly `completionTokens`)
   - `usage.totalTokens` (unchanged)
4. **Parent Relationships**: Uses metadata field for trace correlation instead of unsupported `parentObservationId`

### Validation Script

A comprehensive validation script (`validate-langfuse.ts`) is included to test:
- Environment configuration
- Client initialization
- Trace/generation/event/span creation
- Tool tracing wrapper functionality
- Error handling
- Data flushing

Run with: `npx tsx validate-langfuse.ts`

## Conclusion

This comprehensive Langfuse integration provides complete visibility into the SphereAI system, enabling:

- **Operational Excellence**: Monitor system health and performance
- **User Experience**: Track and improve user journeys
- **Cost Management**: Optimize AI model usage and costs
- **Quality Assurance**: Ensure generated content meets standards
- **Continuous Improvement**: Data-driven system enhancements

The integration follows Langfuse best practices, includes TypeScript compatibility fixes, and provides a solid foundation for scaling the AI-powered educational platform.
