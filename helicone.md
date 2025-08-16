# Helicone Session Implementation Guide

This guide provides a complete implementation of Helicone session tracking for the SphereAI context gathering and agent execution workflow.

## Overview

Helicone sessions allow you to group related AI requests together, providing end-to-end visibility into complex workflows. In our implementation, we track the entire journey from initial course generation through agent execution and tool usage.

## Session Architecture

### Session Hierarchy
```
Context Gathering Session (sessionId: uuid)
├── /context-gather                           # Initial course generation
├── /context-gather/agent-execution          # Main agent processing
│   ├── /context-gather/agent-execution/syllabus    # Syllabus tool
│   ├── /context-gather/agent-execution/web-search  # Web search tool
│   ├── /context-gather/agent-execution/knowledge   # Knowledge search tool
│   └── /context-gather/agent-execution/generation  # Content generation
└── /context-gather/completion               # Final processing
```

### Key Components
- **Session ID**: Unique identifier linking all requests
- **Session Name**: "Context Gathering Session" (groups similar workflows)
- **Session Paths**: Hierarchical structure showing request relationships
- **Custom Properties**: Additional metadata for filtering and analysis

## Implementation Details

### 1. Schema Updates

The Course table now includes session tracking fields:

```typescript
// convex/schema.ts
Course: defineTable({
  prompt: v.string(),
  userId: v.string(),
  createdAt: v.number(),
  sessionId: v.optional(v.string()), // Helicone session tracking
  runId: v.optional(v.string()),     // Correlation ID for pipeline steps
  stages: v.array(/* stage objects */),
})
```

### 2. Context Gathering Phase

**File**: `convex/context.ts`

```typescript
// Generate unique identifiers
const sessionId = crypto.randomUUID();
const runId = crypto.randomUUID();

// Configure Groq client with session headers
const groqClient = createGroq({
  apiKey: groqKey,
  baseURL: "https://groq.helicone.ai/openai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-Posthog-Key": `${process.env.NEXT_PUBLIC_POSTHOG_KEY}`,
    "Helicone-Posthog-Host": `${process.env.NEXT_PUBLIC_POSTHOG_HOST}`,
    "Helicone-User-Id": userId,
    "Helicone-Property-mode": "context mode",
    // Session tracking
    "Helicone-Session-Id": sessionId,
    "Helicone-Session-Path": "/context-gather",
    "Helicone-Session-Name": "Context Gathering Session",
  },
});

// Store session info for later correlation
const CourseId = await ctx.runMutation(api.course.createCourse, {
  prompt: args.messages,
  stages,
  sessionId: sessionId,
  runId: runId,
});

return { CourseId, runId, sessionId };
```

### 3. Agent Execution Phase

**File**: `convex/agent.ts`

```typescript
// Retrieve course with session information
const courseResult = await ctx.runQuery(api.course.getCourse, {
  courseId: args.courseId,
});
const course = courseResult.course;

// Continue existing session
const sessionId = course.sessionId || randomUUID();
const runId = course.runId || randomUUID();

// Configure main agent client
const groqClient = createGroq({
  apiKey: groqKey,
  baseURL: "https://groq.helicone.ai/openai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-Posthog-Key": `${process.env.NEXT_PUBLIC_POSTHOG_KEY}`,
    "Helicone-Posthog-Host": `${process.env.NEXT_PUBLIC_POSTHOG_HOST}`,
    "Helicone-User-Id": userId.subject,
    "Helicone-Property-mode": "Learn mode",
    // Continue session with child path
    "Helicone-Session-Id": sessionId,
    "Helicone-Session-Path": "/context-gather/agent-execution",
    "Helicone-Session-Name": "Context Gathering Session",
  },
});
```

### 4. Tool-Level Session Tracking

Each tool creates its own session-aware client for granular tracking:

```typescript
// Syllabus generation tool
const syllabusClient = createGroq({
  apiKey: groqKey,
  baseURL: "https://groq.helicone.ai/openai/v1",
  headers: {
    "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
    "Helicone-Session-Id": sessionId,
    "Helicone-Session-Path": "/context-gather/agent-execution/syllabus",
    "Helicone-Session-Name": "Context Gathering Session",
    "Helicone-Property-tool": "syllabus-generation",
    "Helicone-Property-query": query,
  },
});

// Web search tool
const searchClient = createGroq({
  // ... same base config
  "Helicone-Session-Path": "/context-gather/agent-execution/web-search",
  "Helicone-Property-tool": "web-search",
  "Helicone-Property-search-query": query,
});

// Knowledge search tool
const knowledgeClient = createGroq({
  // ... same base config
  "Helicone-Session-Path": "/context-gather/agent-execution/knowledge",
  "Helicone-Property-tool": "knowledge-search",
  "Helicone-Property-knowledge-query": query,
});
```

## Dashboard Benefits

### 1. Session Overview
- **Grouped Requests**: All "Context Gathering Session" workflows appear together
- **Timeline View**: See chronological order of requests within each session
- **Cost Analysis**: Total cost per complete workflow
- **Performance Metrics**: End-to-end latency and token usage

### 2. Hierarchical Visualization
```
📊 Context Gathering Session
├── 🎯 /context-gather (120ms, $0.002)
├── 🤖 /context-gather/agent-execution (2.3s, $0.015)
│   ├── 📚 /context-gather/agent-execution/syllabus (800ms, $0.005)
│   ├── 🔍 /context-gather/agent-execution/web-search (400ms, $0.002)
│   └── 🧠 /context-gather/agent-execution/knowledge (300ms, $0.003)
└── ✅ /context-gather/completion (50ms, $0.001)
```

### 3. Filtering and Analysis
- Filter by session name to see all course generation workflows
- Filter by custom properties (tool type, user level, etc.)
- Compare performance across different course types
- Track error rates by workflow step

## Usage Examples

### Frontend Integration
```typescript
// Start context gathering
const contextResponse = await convex.action(api.context.contextgather, {
  messages: userPrompt,
});

const { CourseId, runId, sessionId } = contextResponse;

// Store for tracking (optional)
sessionStorage.setItem('currentSessionId', sessionId);

// Continue with agent execution
const agentResponse = await convex.action(api.agent.agent, {
  courseId: CourseId,
});
```

### Error Handling with Sessions
```typescript
try {
  const result = await generateObject({
    model: sessionAwareClient('openai/gpt-oss-120b'),
    // ... other params
  });
  return result;
} catch (error) {
  // Error is automatically tracked within the session context
  console.error('Error in session:', sessionId, error);
  throw error;
}
```

## Advanced Features

### 1. Custom Properties for Enhanced Filtering
```typescript
headers: {
  // ... base headers
  "Helicone-Property-course-type": course.stages[0]?.title,
  "Helicone-Property-user-tier": "premium",
  "Helicone-Property-complexity": stages.length > 5 ? "high" : "low",
  "Helicone-Property-language": detectLanguage(prompt),
}
```

### 2. Session Completion Tracking
```typescript
// Mark session as complete
const completionClient = createGroq({
  // ... same config
  headers: {
    "Helicone-Session-Path": "/context-gather/completion",
    "Helicone-Property-status": "completed",
    "Helicone-Property-success": "true",
    "Helicone-Property-total-stages": stages.length,
  },
});
```

### 3. A/B Testing with Sessions
```typescript
const experimentGroup = Math.random() > 0.5 ? "control" : "treatment";

headers: {
  // ... other headers
  "Helicone-Property-experiment": "course-generation-v2",
  "Helicone-Property-variant": experimentGroup,
}
```

## Best Practices

### 1. Session ID Management
- ✅ Always use `crypto.randomUUID()` for session IDs
- ✅ Store session ID in database for correlation
- ✅ Pass session ID through the entire pipeline
- ❌ Don't reuse session IDs across different workflows

### 2. Path Structure
- ✅ Use descriptive, hierarchical paths: `/context-gather/agent-execution/tool`
- ✅ Keep path segments short but meaningful
- ✅ Follow consistent naming conventions
- ❌ Don't use special characters or spaces in paths

### 3. Custom Properties
- ✅ Add relevant metadata for filtering
- ✅ Use consistent property names across requests
- ✅ Include user context and workflow parameters
- ❌ Don't include sensitive information in properties

### 4. Error Handling
- ✅ Ensure session tracking continues even on errors
- ✅ Add error context to custom properties
- ✅ Log session ID with error messages
- ❌ Don't let session tracking failures break the main workflow

## Monitoring and Alerts

### Key Metrics to Track
1. **Session Success Rate**: Percentage of sessions that complete successfully
2. **Average Session Duration**: End-to-end timing for complete workflows
3. **Session Cost**: Total cost per course generation workflow
4. **Tool Usage Patterns**: Which tools are used most frequently
5. **Error Rates by Step**: Where failures occur in the pipeline

### Sample Queries in Helicone Dashboard
```sql
-- Sessions by success rate
SELECT session_name,
       COUNT(*) as total_sessions,
       COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_sessions
FROM requests
WHERE session_name = 'Context Gathering Session'
GROUP BY session_name;

-- Average cost per session
SELECT session_id,
       SUM(cost) as total_cost,
       COUNT(*) as request_count
FROM requests
WHERE session_name = 'Context Gathering Session'
GROUP BY session_id;
```

## Troubleshooting

### Common Issues

1. **Missing Session Data**
   - Check that all API calls include session headers
   - Verify session ID is consistent across requests
   - Ensure Helicone API key is properly configured

2. **Broken Session Hierarchy**
   - Verify path syntax follows `/parent/child` format
   - Check for typos in session paths
   - Ensure paths are logically structured

3. **Performance Impact**
   - Session headers add minimal overhead (<1ms)
   - Monitor for any unusual latency increases
   - Consider caching session configurations

### Debug Checklist
- [ ] Session ID is generated and stored correctly
- [ ] All API clients include session headers
- [ ] Paths follow hierarchical structure
- [ ] Custom properties are added consistently
- [ ] Error handling preserves session context
- [ ] Helicone dashboard shows grouped requests

## Conclusion

This implementation provides comprehensive session tracking for the SphereAI workflow, enabling:

- **Complete visibility** into the course generation pipeline
- **Performance optimization** based on real usage data
- **Cost tracking** at the workflow level
- **Error debugging** with full context
- **User experience insights** from session patterns

The session tracking is designed to be non-intrusive and adds minimal overhead while providing maximum insight into your AI application's behavior.
