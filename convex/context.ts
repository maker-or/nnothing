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

    // Initialize Langfuse for this request
    const langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_BASEURL ?? "https://cloud.langfuse.com"
    });

    // Generate a run_id to correlate with the later agent pipeline
    const runId = crypto.randomUUID();

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
       },
    });

    // Create Langfuse trace for this context gathering session
    const trace = langfuse.trace({
      name: 'context-gather',
      userId: userId,
      metadata: {
        run_id: runId,
        phase: 'contextgather',
        source: 'sphereai-agent',
        prompt_length: args.messages?.length ?? 0,
      },
    });

    try {
      const generation = langfuse.generation({
        name: 'syllabus-generation',
        model: 'openai/gpt-oss-120b',
        input: args.messages,
        traceId: trace.id,
        metadata: {
          run_id: runId,
          phase: 'contextgather',
        },
      });

      const result = await generateObject({
        model:groqClient('openai/gpt-oss-120b'),
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
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'context-gather',
          metadata: {
            langfuseTraceId: trace.id,
            run_id: runId,
            phase: 'contextgather',
            userId: userId,
          },
        },
      });

      const generatedResponse = result.object;
const stages = generatedResponse?.stages;

      if (!stages || !Array.isArray(stages) || stages.length < 2) {
        generation.end({
          output: generatedResponse,
          level: 'ERROR',
        });

        langfuse.event({
          name: 'validation-error',
          input: {
            reason: 'Missing or insufficient stages',
            stages_count: stages?.length ?? 0,
          },
          traceId: trace.id,
        });

        throw new Error('Generated syllabus is invalid: missing or insufficient stages.');
      }

      generation.end({
        output: generatedResponse,
      });

      // Persist the course with run_id so the next pipeline step can correlate
      const CourseId = await ctx.runMutation(api.course.createCourse, {
        prompt: args.messages,
        stages,
        // Add run_id to the Course if your schema allows it
        // runId,
      });

      // Update trace with success
      trace.update({
        output: {
          course_id: CourseId,
          stages_count: stages.length,
        },
      });

      return { CourseId, runId };
    } catch (error) {
      langfuse.event({
        name: 'context-error',
        input: {
          error_message: error instanceof Error ? error.message : String(error),
          error_name: error instanceof Error ? error.name : 'UnknownError',
        },
        traceId: trace.id,
      });

      // Log the full error for debugging
      console.error('Context gather error:', error);

      if (error instanceof Error) {
        // Check if it's a JSON parsing error and provide more context
        if (error.message.includes('JSON') || error.message.includes('parse')) {
          throw new Error(`Failed to generate valid course structure. The AI response was not in the expected format. Please try rephrasing your request.`);
        }
        throw new Error(`Course generation failed: ${error.message}`);
      }
      throw new Error('Course generation failed with unknown error');
    } finally {
      await langfuse.flushAsync();
    }
  },
});
