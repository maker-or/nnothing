# PostHog LLM Observability Integration

## Overview

This document describes the comprehensive PostHog LLM observability integration implemented across the course creation pipeline. The integration provides end-to-end tracing of LLM interactions, tool calls, and pipeline stages for better monitoring and debugging.

## Architecture

### Continuous Tracing Flow

```
Context Gathering (context.ts)
    ↓ (traceId, runId)
Agent Processing (agent.ts)
    ↓ (per stage processing)
Tool Calls & LLM Interactions
    ↓ (detailed observability)
Course Creation Complete
```

### Key Components

1. **Shared Trace Context**: A single `traceId` flows through the entire pipeline
2. **Stage-Level Tracking**: Each course stage is individually tracked
3. **Tool Call Monitoring**: Every tool execution is logged with inputs/outputs
4. **LLM Request Tracing**: All model interactions are traced with PostHog

## Implementation Details

### Context Gathering (`context.ts`)

**Events Tracked:**
- `course_context_gathering_started` - Pipeline initiation
- `course_structure_generated` - Successful course structure creation
- `course_context_gathering_completed` - Context phase completion
- `course_context_gathering_failed` - Error handling

**Key Properties:**
```typescript
{
  trace_id: string,           // Unique identifier for entire pipeline
  run_id: string,             // Execution run identifier
  user_id: string,            // User performing the action
  pipeline_stage: "context_gathering",
  prompt: string,             // User's original request
  stages_count: number,       // Number of stages generated
  course_id: string          // Generated course ID
}
```

### Agent Processing (`agent.ts`)

**Events Tracked:**
- `agent_stage_processing_started` - All stages processing begins
- `agent_individual_stage_started` - Individual stage processing
- `agent_individual_stage_completed` - Individual stage completion
- `agent_individual_stage_failed` - Individual stage errors
- `agent_processing_completed` - All stages completed

**Stream Processing Events:**
- `agent_stream_tool_call` - Tool call detected in stream
- `agent_stream_tool_result` - Tool result received in stream
- `agent_stream_finished` - Stream processing completed
- `agent_stream_error` - Stream processing errors

**Structured Generation Events:**
- `agent_structured_generation_started` - Object generation begins
- `agent_structured_generation_completed` - Object generation completes

### Tool Call Observability

Each tool execution is comprehensively tracked:

**Tool Call Lifecycle:**
1. `agent_tool_call_started` - Tool execution begins
2. `agent_tool_call_completed` - Tool execution succeeds
3. `agent_tool_call_failed` - Tool execution fails (if applicable)

**Monitored Tools:**
- `getSyllabusTools` - Syllabus generation
- `webSearchTools` - External web search via Exa
- `knowledgeSearchTools` - Knowledge base search
- `getCodeTools` - Code example generation
- `testTools` - Test question creation
- `flashcardsTools` - Flashcard generation
- `svgTool` - SVG diagram creation

**Tool Properties Tracked:**
```typescript
{
  trace_id: string,
  run_id: string,
  tool_name: string,
  tool_input: object,          // Input parameters passed to tool
  tool_output_size: number,    // Size of tool output
  stage_index: number,         // Which course stage
  stage_title: string,         // Stage being processed
  // Tool-specific properties (e.g., results_count for web search)
}
```

### LLM Model Tracing

All LLM interactions use PostHog's `withTracing` wrapper:

```typescript
const tracedModel = (modelName: string, additionalProperties = {}) => {
  return withTracing(google(modelName), phClient, {
    posthogDistinctId: userId,
    posthogTraceId: traceId,
    posthogProperties: {
      pipeline_stage: "agent_processing",
      model_name: modelName,
      ...additionalProperties
    }
  });
};
```

## Environment Variables Required

```bash
# PostHog Configuration
POSTHOG_API_KEY=your_posthog_api_key
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Helicone Integration (optional but recommended)
HELICONE_API_KEY=your_helicone_key
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_public_key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
```

## Trace Correlation

### Frontend Integration

The frontend passes trace metadata from context gathering to agent processing:

```typescript
// AiHome.tsx
const { CourseId, traceId, runId } = await learn({
  messages: value.userPrompt.trim(),
});

// Pass trace context to agent
runAgent({
  courseId: CourseId,
  traceId,
  runId
});
```

### Backend Correlation

Both backend functions use the same `traceId` to maintain correlation:

```typescript
// context.ts - generates traceId
const traceId = crypto.randomUUID();
return { CourseId, runId, traceId };

// agent.ts - receives and uses traceId
const traceId = args.traceId || randomUUID();
```

## Monitoring & Analytics

### Key Metrics to Monitor

1. **Pipeline Success Rate**
   - Track `course_context_gathering_completed` vs `course_context_gathering_failed`
   - Track `agent_processing_completed` vs stage failures

2. **Tool Performance**
   - Tool execution times
   - Tool failure rates
   - Tool output sizes

3. **Stage Processing**
   - Average time per stage
   - Stages that frequently fail
   - Content generation quality metrics

4. **LLM Usage**
   - Token consumption per stage
   - Model response times
   - Cost tracking

### PostHog Dashboard Queries

**Pipeline Success Rate:**
```
events.where(event == 'course_context_gathering_started')
  .groupBy(properties.trace_id)
  .join(events.where(event == 'agent_processing_completed'))
```

**Tool Usage Analysis:**
```
events.where(event == 'agent_tool_call_completed')
  .groupBy(properties.tool_name)
  .aggregate(count, avg(properties.tool_output_size))
```

**Stage Processing Times:**
```
events.where(event == 'agent_individual_stage_started')
  .join(events.where(event == 'agent_individual_stage_completed'))
  .groupBy(properties.stage_title)
  .aggregate(avg(timestamp_diff))
```

## Benefits

1. **End-to-End Visibility**: Complete pipeline tracing from user request to course completion
2. **Performance Optimization**: Identify bottlenecks in tool calls and LLM interactions
3. **Error Tracking**: Detailed error context for debugging failed course generations
4. **User Experience**: Monitor completion rates and identify user experience issues
5. **Cost Optimization**: Track LLM usage and optimize model selection
6. **A/B Testing**: Compare different tool configurations and model choices

## Best Practices

1. **Always Flush Data**: Ensure PostHog data is flushed at the end of each action
2. **Consistent Properties**: Use consistent property names across events
3. **Error Handling**: Always track errors with sufficient context
4. **Privacy**: Be mindful of PII in tracked properties
5. **Performance**: Don't let observability significantly impact performance

## Troubleshooting

### Common Issues

1. **Missing Trace Correlation**: Ensure `traceId` is passed from frontend to backend
2. **PostHog Not Receiving Events**: Check API key and network connectivity
3. **Large Property Values**: Truncate large outputs to avoid PostHog limits
4. **Memory Usage**: Ensure PostHog client is properly shut down

### Debug Logging

Enable detailed logging by checking console outputs:
- `🟢` - Process start events
- `🔄` - Process continuation events
- `✅` - Success events
- `❌` - Error events
- `🔍` - Tool calls
- `🔧` - Stream events

This observability setup provides comprehensive insights into the course creation pipeline, enabling data-driven improvements and robust error handling.
