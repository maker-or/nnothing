'use node';

import { v } from 'convex/values';
import { action } from './_generated/server';
import { api, internal } from './_generated/api';
import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { withTracing } from '@posthog/ai';
import { PostHog } from 'posthog-node';
import { randomUUID } from 'crypto';

/**
 * Action: streamStageChat
 *
 * Purpose:
 *  Lightweight stage/course–contextual chat that:
 *    - Reuses existing chats/messages + streamingSessions infrastructure
 *    - Injects full stage & course context every turn (user requested full, no truncation)
 *    - Maintains conversation coherence by including prior messages of the chat
 *    - Uses a shorter, focused system prompt (no Pinecone / external KB)
 *
 * Args:
 *  chatId           Id<'chats'> (must exist; front-end creates on first AI use per stage)
 *  stageId          Id<'Stage'>
 *  courseId         Id<'Course'>
 *  message          string (current user message)
 *  parentMessageId? optional Id<'messages'> (threading, if needed)
 *
 * Returns:
 *  assistantMessageId (Id<'messages'>)
 */
export const streamStageChat = action({
  args: {
    chatId: v.id('chats'),
    stageId: v.id('Stage'),
    courseId: v.id('Course'),
    message: v.string(),
    parentMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args): Promise<any> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Not authenticated');
    const userId = identity.subject;

    const groqKey = process.env.GROQ_API_KEY || '';
    if (!groqKey || !groqKey.startsWith('gsk_')) {
      throw new Error('Missing or invalid GROQ_API_KEY (must start with gsk_)');
    }

    // Fetch stage & course (stage query already validates membership of course)
    const stageResult = await ctx.runQuery(api.stage.getStage, {
      courseId: args.courseId,
      stageId: args.stageId,
    });

    const courseResult = await ctx.runQuery(api.course.getCourse, {
      courseId: args.courseId,
    });

    if (!stageResult.stage) {
      throw new Error(stageResult.error || 'Stage not found');
    }
    if (!courseResult.course) {
      throw new Error(courseResult.error || 'Course not found');
    }

    const stage = stageResult.stage;
    const course = courseResult.course;

    // Build full context (untruncated as requested)
    const contextParts: string[] = [];

    contextParts.push(
      `COURSE PROMPT:\n${course.prompt ?? '(none)'}\n`,
      `STAGE TITLE: ${stage.title}\n`,
      `TOTAL SLIDES: ${stage.slides.length}\n`
    );

    stage.slides.forEach((slide: any, idx: number) => {
      contextParts.push(
        `--- Slide ${idx + 1} ---`,
        `Name: ${slide.name ?? ''}`,
        `Title: ${slide.title ?? ''}`,
        slide.subTitles ? `SubTitle: ${slide.subTitles}` : '',
        slide.content ? `Content:\n${slide.content}` : '',
        slide.code?.content
          ? `Code (${slide.code.language || 'text'}):\n${slide.code.content}`
          : '',
        slide.links && slide.links.length
          ? `Links:\n${slide.links.join('\n')}`
          : '',
        slide.youtubeSearchText
          ? `YouTube Search Text: ${slide.youtubeSearchText}`
          : '',
        slide.bulletPoints?.length
          ? `Bullet Points:\n${slide.bulletPoints
              .map((b: string) => `- ${b}`)
              .join('\n')}`
          : '',
        slide.flashcardData?.length
          ? `Flashcards:\n${slide.flashcardData
              .map((f: any, i: number) => `Q${i + 1}: ${f.question}\nA: ${f.answer}`)
              .join('\n\n')}`
          : '',
        slide.testQuestions?.length
          ? `Test Questions:\n${slide.testQuestions
              .map(
                (q: any, i: number) =>
                  `Q${i + 1}: ${q.question}\nOptions: ${(q.options || []).join(
                    ' | '
                  )}\nAnswer: ${q.answer}`
              )
              .join('\n\n')}`
          : ''
      );
    });

    const fullContext = contextParts.filter(Boolean).join('\n');

    // Get existing chat details & previous messages
    const chat = await ctx.runQuery(api.chats.getChat, {
      chatId: args.chatId,
    });
    if (!chat) {
      throw new Error('Chat not found or unauthorized');
    }

    const previousMessages = await ctx.runQuery(api.message.getMessages, {
      chatId: args.chatId,
    });

    // Construct message sequence
    // 1. System prompt (concise, stage-focused)
    const systemPrompt = `You are a focused study helper for a user viewing a specific course stage.
Goals:
1. Clarify doubts about the current stage and course.
2. Give concise, exam-oriented explanations.
3. Prefer material from the provided stage & course context. If user asks beyond it, answer briefly and relate back when possible.
Format (adapt if not all needed):
- Quick Answer: 1–2 plain sentences.
- Key Points: 3–6 bullets.
- Example / Analogy: one short illustrative example.
- Important Terms: (only if helpful) each 1 line.
- Exam Must-Knows: 3–5 bullets.
- (Optional) Follow-up Question.
Rules:
- Do NOT invent details absent from context if the question is about the stage/course; instead say what is missing.
- Keep sentences short; define jargon immediately.
- Return markdown only (no HTML).`;

    // 2. Context as an additional system message
    const contextSystemMessage = `Stage & Course Context (verbatim, full):\n${fullContext}`;

    const allMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: contextSystemMessage },
    ];

    // 3. Previous conversation history (user + assistant)
    for (const msg of previousMessages) {
      // Stored messages may contain structured JSON if they followed ai.ts pattern;
      // We'll attempt to extract plain text content; fallback to raw.
      let content = msg.content;
      try {
        const parsed = JSON.parse(msg.content);
        if (parsed && typeof parsed.content === 'string') {
          content = parsed.content;
        }
      } catch {
        /* leave raw */
      }
      allMessages.push({
        role: msg.role,
        content,
      });
    }

    // 4. Current user message
    allMessages.push({ role: 'user', content: args.message });

    // Clear any active streaming session for this chat
    await ctx.runMutation(api.message.clearStreamingSession, {
      chatId: args.chatId,
    });

    // Create placeholder assistant message
    const assistantMessageId: any = await ctx.runMutation(
      api.message.addMessage,
      {
        chatId: args.chatId,
        role: 'assistant',
        content: '',
        parentId: args.parentMessageId,
        model: 'openai/gpt-oss-120b',
      }
    );

    // Create streaming session
    const sessionId = await ctx.runMutation(
      api.message.createStreamingSession,
      {
        chatId: args.chatId,
        messageId: assistantMessageId,
      }
    );

    // Observability / tracing
    const phClient = new PostHog(process.env.POSTHOG_API_KEY || '', {
      host: process.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });

    try {
      const groqClient = createGroq({
        apiKey: groqKey,
        baseURL: 'https://groq.helicone.ai/openai/v1',
        headers: {
          'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`,
          'Helicone-Posthog-Key': `${process.env.NEXT_PUBLIC_POSTHOG_KEY}`,
          'Helicone-Posthog-Host': `${process.env.NEXT_PUBLIC_POSTHOG_HOST}`,
          'Helicone-User-Id': userId,
          'Helicone-Property-mode': 'Stage Chat',
        },
      });

      const tracedModel = withTracing(
        groqClient('openai/gpt-oss-120b'),
        phClient,
        {
          posthogDistinctId: userId,
            posthogTraceId: randomUUID(),
          posthogProperties: {
            conversation_id: args.chatId,
            stage_id: String(args.stageId),
            course_id: String(args.courseId),
            mode: 'stage-chat',
          },
          posthogPrivacyMode: false,
        }
      );

      const response = streamText({
        model: tracedModel,
        messages: allMessages,
        providerOptions: {
          groq: {
            reasoningFormat: 'parsed',
            reasoningEffort: 'low',
            parallelToolCalls: true,
            user: userId,
          },
        },
        // We already place formatting rules in the system prompt; no extra "system" param needed here.
      });

      let fullContent = '';
      let tokenCount = 0;
      let firstChunkSeen = false;

      // Stream loop
      for await (const chunk of response.textStream) {
        if (!chunk) continue;
        fullContent += chunk;
        tokenCount++;

        // Update streaming session with incremental chunk
        await ctx.runMutation(internal.message.updateStreamingSession, {
          sessionId,
          chunk,
        });

        // If we disable input only until first chunk, frontend can re-enable upon detecting any content
        if (!firstChunkSeen) {
          firstChunkSeen = true;
        }
      }

      // (Optional) reasoning capture (if model supplies)
      let reasoningContent: string | null = null;
      if (response.reasoning) {
        try {
          reasoningContent = JSON.stringify(await response.reasoning);
        } catch {
          reasoningContent = null;
        }
      }

      // Package final message content (mirrors ai.ts structure)
      if (fullContent) {
        const messageContent = {
          type: 'ai-response',
          content: fullContent,
          reasoning: reasoningContent,
          model: 'openai/gpt-oss-120b',
          timestamp: Date.now(),
          meta: {
            tokenCount,
            stageId: String(args.stageId),
            courseId: String(args.courseId),
            contextIncluded: true,
          },
        };

        await ctx.runMutation(api.message.updateMessage, {
          messageId: assistantMessageId,
            content: JSON.stringify(messageContent),
        });
      }

      // Mark streaming complete
      await ctx.runMutation(internal.message.updateStreamingSession, {
        sessionId,
        chunk: '',
        isComplete: true,
      });

      return assistantMessageId;
    } catch (err) {
      console.error('Stage chat streaming error:', err);

      await ctx.runMutation(api.message.updateMessage, {
        messageId: assistantMessageId,
        content: `Error: ${
          err instanceof Error ? err.message : 'Unknown error'
        }`,
      });

      // End streaming session
      await ctx.runMutation(internal.message.updateStreamingSession, {
        sessionId,
        chunk: '',
        isComplete: true,
      });

      throw new Error(
        `Stage chat failed: ${err instanceof Error ? err.message : 'Unknown'}`
      );
    } finally {
      await phClient.shutdown();
    }
  },
});
