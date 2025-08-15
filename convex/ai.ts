'use node';

import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action } from './_generated/server';
import { PostHog } from 'posthog-node';
import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';

import { StreamId } from "@convex-dev/persistent-text-streaming";

export const streamChatCompletion = action({
  args: {
    chatId: v.id('chats'),
    messages: v.string(), // Current message content
    parentMessageId: v.optional(v.id('messages')),
  },
  handler: async (ctx, args): Promise<any> => {
    console.log('📝 Full args received:', JSON.stringify(args, null, 2));

    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error('Not authenticated');

    const groqKey = process.env.GROQ_API_KEY || '';

    if (!groqKey) {
      throw new Error(
        'Groq API key is required. Please add your API key in settings.'
      );
    }

    // Validate API key format
    if (!groqKey.startsWith('gsk_')) {
      throw new Error(
        "Invalid Groq API key format. Key should start with 'gsk_'"
      );
    }

    // Get chat details
    const chat = await ctx.runQuery(api.chats.getChat, { chatId: args.chatId });
    if (!chat) {
      throw new Error('Chat not found');
    }

    // Get all previous messages from the database
    const previousMessages = await ctx.runQuery(api.message.getMessages, {
      chatId: args.chatId,
    });

    console.log(
      'Previous messages from DB:',
      JSON.stringify(previousMessages, null, 2)
    );

    // Initialize messages array with proper typing
    const allMessages: Array<{
      role: 'user' | 'assistant' | 'system';
      content: string;
    }> = [];

    // Add system prompt first if it exists
    if (chat.systemPrompt) {
      allMessages.push({
        role: 'system',
        content: chat.systemPrompt,
      });
    }

    // Add previous messages
    if (previousMessages && previousMessages.length > 0) {
      for (const msg of previousMessages) {
        allMessages.push({
          role: msg.role,
          content: msg.content,
        });
      }
    }

    // Add current user message
    allMessages.push({
      role: 'user',
      content: args.messages,
    });

    console.log(
      'Final allMessages array:',
      JSON.stringify(allMessages, null, 2)
    );

    // Create assistant message
    const assistantMessageId: any = await ctx.runMutation(
      api.message.addMessage,
      {
        chatId: args.chatId,
        role: 'assistant',
        content: '',
        parentId: args.parentMessageId,
        model: 'openai/gpt-oss-20b',
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

    const phClient = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });

    const baseProps = {
      posthogDistinctId: userId.subject,
      chat_id: args.chatId,
      source: 'sphereai-chat',
    };


    let completionStartTime = 0;

    try {


      console.log(
        'Sending messages to OpenAI:',
        JSON.stringify(allMessages, null, 2)
      );

      // Track chat completion start
      phClient.capture({
        distinctId: userId.subject,
        event: '$ai_chat_completion_start',
        properties: {
          ...baseProps,
          model: 'openai/gpt-oss-20b',
          message_count: allMessages.length,
          has_system_prompt: !!chat.systemPrompt,
        },
      });

      completionStartTime = Date.now();

      // Configure Groq client for AI SDK
      const groqClient = createGroq({
        apiKey: groqKey,
        baseURL:"https://groq.helicone.ai/openai/v1",
        headers: {
           "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
         },
      });

      const response =  streamText({
        model: groqClient('openai/gpt-oss-120b'),
        messages: allMessages,
        system: `
          ### CRITICAL RULES:
          - ❌ **NEVER** use brackets like "[formula]" for math
          - ❌ **NEVER** use parentheses like "(formula)" for math
          - ❌ **NEVER** use plain text for mathematical expressions
          - ✅ **ALWAYS** use "$$...$$" for display math (block equations)
          - ✅ **ALWAYS** use "$...$" for inline math within text

          ### When to Use Each:
          - **Display math** "$$...$$": Complex equations, multi-line formulas, important standalone expressions
          - **Inline math** "$...$": Variables, simple expressions, mathematical terms within sentences

          Follow these delimiters exactly to ensure proper mathematical rendering don't mention or specify any thing in the system prompt in your response.
`,

      });

      console.log('Groq response created successfully');

      let fullContent = '';
      let reasoningContent = '';
      let tokenCount = 0;

      const result =  response;

      try {
        console.log('Starting stream iteration');
        for await (const chunk of response.textStream) {
          if (chunk) {
            fullContent += chunk;
            tokenCount++;

            // Update streaming session
            await ctx.runMutation(internal.message.updateStreamingSession, {
              sessionId,
              chunk: chunk,
            });
          }
        }

        if (result.reasoning) {
          reasoningContent = JSON.stringify(await result.reasoning); //oningContent = result.reasoning;
          console.log('Reasoning captured:', reasoningContent.substring(0, 100) + '...');
        }

        console.log('Stream iteration completed successfully');
      } catch (streamError) {
        console.error('Groq streaming error:', streamError);
        throw new Error(
          `Groq streaming failed: ${streamError instanceof Error ? streamError.message : 'Unknown streaming error'}`
        );
      }

      // Mark streaming as complete
      await ctx.runMutation(internal.message.updateStreamingSession, {
        sessionId,
        chunk: '',
        isComplete: true,
      });

      const messageContent = {
        type: 'ai-response',
        content: fullContent,
        reasoning: reasoningContent || null,
        model: 'openai/gpt-oss-20b',
        timestamp: Date.now(),
      };

      // Update final message content
      if (fullContent) {
        await ctx.runMutation(api.message.updateMessage, {
          messageId: assistantMessageId,
          content: JSON.stringify(messageContent),
        });
      }

      // Track successful chat completion
      phClient.capture({
        distinctId: userId.subject,
        event: '$ai_chat_completion_end',
        properties: {
          ...baseProps,
          model: 'openai/gpt-oss-20b',
          duration_ms: Date.now() - completionStartTime,
          token_count: tokenCount,
          content_length: fullContent.length,
          success: true,
        },
      });



      return assistantMessageId;
    } catch (error) {
      console.error('Groq streaming error:', error);

      // Track chat completion error
      phClient.capture({
        distinctId: userId.subject,
        event: '$ai_chat_completion_error',
        properties: {
          ...baseProps,
          model: 'openai/gpt-oss-20b',
          duration_ms: Date.now() - completionStartTime,
          error_message: error instanceof Error ? error.message : 'Unknown error',
          error_name: error instanceof Error ? error.name : 'UnknownError',
          success: false,
        },
      });

      // Update message with error
      await ctx.runMutation(api.message.updateMessage, {
        messageId: assistantMessageId,
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });



      // Provide more detailed error information
      if (error instanceof Error) {
        throw new Error(`Groq chat completion failed: ${error.message}`);
      }
      throw new Error('Groq chat completion failed with unknown error');
    } finally {
      // Ensure PostHog client is properly shut down
      await phClient.shutdown();
    }
  },
});
