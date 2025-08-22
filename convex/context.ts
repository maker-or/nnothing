'use node';

import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { v } from 'convex/values';
import { z } from 'zod';
import { api } from './_generated/api';
import { action } from './_generated/server';
import { Langfuse } from "langfuse";
import crypto from 'node:crypto';
import { createGroq } from '@ai-sdk/groq';
import { randomUUID } from 'crypto';
import { withTracing } from "@posthog/ai"
import { PostHog } from 'posthog-node';

export const StageSchema = z.object({
  title: z.string().min(2, 'Stage title is required'),
  purpose: z.string().min(2, 'Stage purpose is required'),
  include: z.array(z.string()).min(1, 'At least one topic/activity must be included'),
  outcome: z.string().min(2, 'Learning outcome is required'),
  discussion_prompt: z.string(),
});

export const CourseSchema = z.object({
  stages: z.array(StageSchema).min(2, 'A course must have at least 2 stages.'),
});

export const contextgather = action({
  args: {
    messages: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    const userIdentity = await ctx.auth.getUserIdentity();
    if (!userIdentity) throw new Error('Not authenticated');

    const userId = userIdentity.subject;
    const openRouterKey = process.env.OPENROUTER_API_KEY || '';
    if (!openRouterKey) {
      throw new Error('OpenRouter API key is required. Please add your API key in settings.');
    }
    if (!openRouterKey.startsWith('sk-')) {
      throw new Error("Invalid OpenRouter API key format. Key should start with 'sk-'");
    }

    const groqKey = process.env.GROQ_API_KEY || '';


    if (!groqKey) {
      throw new Error(
        'Groq API key is required. Please add your API key in settings.'
      );
    }

    const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });


    // Initialize Langfuse for this request
    const langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_BASEURL ?? "https://cloud.langfuse.com"
    });

    // Generate a trace_id to correlate with the entire course creation pipeline
    const traceId = crypto.randomUUID();
    const runId = crypto.randomUUID();

    // Create PostHog tracer context for the entire pipeline
    const tracingContext = {
      posthogDistinctId: userId,
      posthogTraceId: traceId,
      posthogProperties: {
        "pipeline_stage": "context_gathering",
        "user_id": userId,
        "run_id": runId,
        "course_creation_flow": true,
        "prompt": args.messages
      },
      posthogPrivacyMode: false,
    };

    console.log(`🟢 CONTEXT GATHERING - Starting with trace_id: ${traceId}, run_id: ${runId}`);

    // OpenRouter client
    const openrouter = createOpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: openRouterKey,
    });

    const groqClient = createGroq({
      apiKey: groqKey,
      baseURL:"https://groq.helicone.ai/openai/v1",
      headers: {
         "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
         "Helicone-Posthog-Key": `${process.env.NEXT_PUBLIC_POSTHOG_KEY}`,
         "Helicone-Posthog-Host": `${process.env.NEXT_PUBLIC_POSTHOG_HOST}`,
         "Helicone-User-Id":userId,
        "Helicone-Property-mode":"context mode",
        "Helicone-Property-trace-id": traceId,
        "Helicone-Property-run-id": runId,
       },
    });

    // Create traced model for context gathering
    const model = withTracing(groqClient("openai/gpt-oss-120b"), phClient, tracingContext);


    try {
      // Track context gathering start
      phClient.capture({
        distinctId: userId,
        event: 'course_context_gathering_started',
        properties: {
          trace_id: traceId,
          run_id: runId,
          prompt: args.messages,
          pipeline_stage: 'context_gathering'
        }
      });

      console.log(`🔄 CONTEXT GATHERING - Generating course structure with model`);

      const result = await generateObject({
        model: model,
        system: `You are an expert AI curriculum designer who creates structured learning courses.

Your task is to create a comprehensive learning course with multiple stages based on the user's request.

Each stage should have:
- title: A clear, descriptive title for the learning stage
- purpose: The main learning objective of this stage
- include: An array of specific topics, activities, or concepts to cover
- outcome: What the learner should be able to do after completing this stage
- discussion_prompt: A thought-provoking question or prompt to encourage reflection

Requirements:
1. Create at least 2 stages minimum
2. Each stage should build logically on the previous one
3. Include practical, actionable content
4. Make outcomes specific and measurable
5. Ensure discussion prompts encourage critical thinking

IMPORTANT: You must respond with valid JSON that exactly matches the required schema. Do not include any explanatory text outside the JSON structure.`,
        prompt: `Create a structured learning course for: ${args.messages}

Please design a course with multiple stages that will help someone learn this topic effectively. Each stage should build upon the previous one and include practical learning activities.`,
        schema: CourseSchema,
        maxRetries: 3,

      });

      const generatedResponse = result.object;
      const stages = generatedResponse?.stages;

      if (!stages || !Array.isArray(stages) || stages.length < 2) {
        throw new Error('Generated syllabus is invalid: missing or insufficient stages.');
      }

      console.log(`✅ CONTEXT GATHERING - Generated ${stages.length} stages successfully`);

      // Track successful course structure generation
      phClient.capture({
        distinctId: userId,
        event: 'course_structure_generated',
        properties: {
          trace_id: traceId,
          run_id: runId,
          stages_count: stages.length,
          stages_titles: stages.map(s => s.title),
          pipeline_stage: 'context_gathering'
        }
      });

      // Persist the course with trace metadata
      const CourseId = await ctx.runMutation(api.course.createCourse, {
        prompt: args.messages,
        stages,
        // Add trace metadata if your schema supports it
        // traceId,
        // runId,
      });

      // Track course creation completion
      phClient.capture({
        distinctId: userId,
        event: 'course_context_gathering_completed',
        properties: {
          trace_id: traceId,
          run_id: runId,
          course_id: CourseId,
          pipeline_stage: 'context_gathering',
          next_stage: 'agent_processing'
        }
      });

      console.log(`🟢 CONTEXT GATHERING - Completed successfully. Course ID: ${CourseId}, Trace ID: ${traceId}`);

      return { CourseId, runId, traceId };
    } catch (error) {
      // Track context gathering error
      phClient.capture({
        distinctId: userId,
        event: 'course_context_gathering_failed',
        properties: {
          trace_id: traceId,
          run_id: runId,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          pipeline_stage: 'context_gathering'
        }
      });

      // Log the full error for debugging
      console.error(`❌ CONTEXT GATHERING - Error with trace_id: ${traceId}:`, error);

      if (error instanceof Error) {
        // Check if it's a JSON parsing error and provide more context
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw new Error(`Failed to generate valid course structure. The AI response was not in the expected format. Please try rephrasing your request.`);
        }
        throw new Error(`Course generation failed: ${error.message}`);
      }
      throw new Error('Course generation failed with unknown error');
    } finally {
      try {
        await langfuse.flushAsync();
        await phClient.shutdown();
        console.log(`✅ CONTEXT GATHERING - Langfuse and PostHog data flushed successfully for trace_id: ${traceId}`);
      } catch (flushError) {
        console.error(`❌ CONTEXT GATHERING - Failed to flush data for trace_id: ${traceId}:`, flushError);
      }
    }
  },
});
