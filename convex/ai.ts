'use node';


import { v } from 'convex/values';
import { getEmbedding } from "../utils/embeddings";
import { api, internal } from './_generated/api';
import { action } from './_generated/server';
import { withTracing } from "@posthog/ai"
import { PostHog } from 'posthog-node';
import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { randomUUID } from 'crypto';
import { Pinecone } from "@pinecone-database/pinecone";




export const streamChatCompletion = action({
  args: {
    chatId: v.id('chats'),
    messages: v.string(), // Current message content
    parentMessageId: v.optional(v.id('messages')),
    useKnowledgeBase: v.optional(v.boolean()), // Whether to search Pinecone knowledge base
  },




  handler: async (ctx, args): Promise<any> => {
    console.log('📝 Full args received:', JSON.stringify(args, null, 2));

    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error('Not authenticated');


    const postkey = process.env.NEXT_PUBLIC_POSTHOG_KEY!;
    if(!postkey){
      console.error("no key from posthog")
    }



    const groqKey = process.env.GROQ_API_KEY || '';

    const pineconekey = process.env.PINECONE_API_KEY;

    if (!groqKey) {
      throw new Error(
        'Groq API key is required. Please add your API key in settings.'
      );
    }


    if (!pineconekey) {
      throw new Error(
        "pineconekey API key is required. Please add your API key in settings.",
      );
    }

    // Validate API key format
    if (!groqKey.startsWith('gsk_')) {
      throw new Error(
        "Invalid Groq API key format. Key should start with 'gsk_'"
      );
    }

    const pinecone = new Pinecone({
      apiKey: pineconekey,
    });

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




    // Clear any existing streaming sessions for this chat
    await ctx.runMutation(api.message.clearStreamingSession, {
      chatId: args.chatId,
    });

    // Create assistant message
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

    const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });


    try {
      console.log(
        'Sending messages to OpenAI:',
        JSON.stringify(allMessages, null, 2)
      );


      // Configure Groq client for AI SDK
      const groqClient = createGroq({
        apiKey: groqKey,
        baseURL:"https://groq.helicone.ai/openai/v1",
        headers: {
           "Helicone-Auth": `Bearer ${process.env.HELICONE_API_KEY}`,
           "Helicone-Posthog-Key": `${process.env.NEXT_PUBLIC_POSTHOG_KEY}`,
           "Helicone-Posthog-Host": `${process.env.NEXT_PUBLIC_POSTHOG_HOST}`,
           "Helicone-User-Id":userId.subject,
           "Helicone-Property-mode":"Chat mode",
         },
      });


      // Only search knowledge base if explicitly requested
      if (args.useKnowledgeBase) {
        const embeddings = await getEmbedding(
          allMessages.map((msg) => msg.content).join(" "),
        );

        const index = pinecone.index("design");
        const Semantic_search = await index.namespace("__default__").query({
          vector: embeddings,
          topK: 10,
          includeMetadata: true,
          includeValues: false,
        });

        const textContent = Semantic_search.matches
          .map((match) => match.metadata?.text)
          .filter(Boolean);
        console.log("the textcontent is : ", textContent);
        const resultsString = textContent.join("\n\n");
        console.log("############################################");
        console.log("the resultsString is : ", resultsString);
        console.log("############################################");
        // Add the retrieved context as a system message
        if (resultsString) {
          allMessages.unshift({
            role: "assistant",
            content: `Relevant context from knowledge base:\n\n${resultsString} when using this make sure that you also specify the sources at the end of the respose`,
          });
        }
      }


      const model = withTracing(groqClient("openai/gpt-oss-120b"), phClient, {
        posthogDistinctId: userId.subject,
        posthogTraceId: randomUUID(),
        posthogProperties: { "conversation_id": args.chatId, },
        posthogPrivacyMode: false,
      });


      const response =  streamText({
        model: model,
        messages: allMessages,
        providerOptions: {
            groq: {
              reasoningFormat: 'parsed',
              reasoningEffort: 'low',
              parallelToolCalls: true, // Enable parallel function calling (default: true)
              user: userId.subject, // Unique identifier for end-user (optional)
            },
          },

        system: `You are SphereAI, a friendly study assistant focused on exam readiness. Use provided knowledge base/context as the primary source. Keep everything simple first; use technical terms only when essential and define them in one short line. For every answer:

        Start with a short, plain-language summary (2–3 sentences).

        Give 3–6 key points or steps in short bullets.

        Include one tiny example or analogy.

        Add “Need-to-know terms” with one-line definitions only if required.

        End with “Exam must-knows” (3–5 bullets) and one short practice question with a brief solution.
        If context is provided, say “Based on class notes/KB:” and build the response from it. If context is missing or conflicting, state it briefly, prefer course materials, and proceed with the simplest correct explanation. Keep sentences short. Avoid jargon unless exam-required.

        CRITICAL MATH RULES:
        ❌ NEVER use brackets like "[formula]" for math.

        ❌ NEVER use parentheses like "(formula)" for math.

        ❌ NEVER use plain text for mathematical expressions.

        ### When to Use Each:
           - **Display math** "$$...$$": Complex equations, multi-line formulas, important standalone expressions
           - **Inline math** "$...$": Variables, simple expressions, mathematical terms within sentences

        Follow these delimiters and diagram rules exactly to ensure proper rendering

        MermaidDIAGRAM RULES
        Use Mermaid diagrams whenever a diagram, chart, or visual or UML,Design-pattern explanation is appropriate or directly requested.

        Always use proper Mermaid syntax for all diagrams, starting with the diagram type (e.g., flowchart, sequenceDiagram, classDiagram, etc).

        Place all Mermaid code within triple backtick code blocks and specify MERMAID as the language.

        Never include Markdown formatting or code block markers within the diagram code itself.

        Avoid broken diagrams: Ensure there are no misspelled keywords/types; unknown words, bad YAML frontmatter, or malformed syntax will break Mermaid rendering. Double-check for valid structure.

        For all diagram types, do not use reserved keywords or symbols in ways that break diagrams (e.g. words like end in flowcharts/sequence diagrams should be wrapped in quotation marks if needed).

        Do not nest nodes inside nodes unless documentation confirms it is valid for that diagram type. If you need to, wrap them in quotation marks.

        Comments in Mermaid: Only use %% for comments. Don’t use curly braces ({}) inside %% comments, as it causes breakage.

        Always ensure directed/undirected graph arrows, edge/label syntax, class/entity/relationship syntax adhere to Mermaid documentation for the chosen diagram type.

        For text/label nodes in diagrams, wrap text in square or round brackets when necessary (according to Mermaid syntax) to avoid mis-parsing.

        For all Mermaid diagrams, ensure that special characters or words are escaped or wrapped as needed per documentation.

        Never output broken or partial Mermaid code. If the diagram cannot be completed, give an explanatory message, not partial syntax.

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

            // Update streaming session with current content
            await ctx.runMutation(internal.message.updateStreamingSession, {
              sessionId,
              chunk: chunk,
            });
          }
        }

        if (result.reasoning) {
          reasoningContent = JSON.stringify(await result.reasoning);
          console.log('Reasoning captured:', reasoningContent.substring(0, 100) + '...');
        }

        console.log('Stream iteration completed successfully');
      } catch (streamError) {
        console.error('Groq streaming error:', streamError);
        throw new Error(
          `Groq streaming failed: ${streamError instanceof Error ? streamError.message : 'Unknown streaming error'}`
        );
      }

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

      // Mark streaming as complete AFTER updating the final message
      await ctx.runMutation(internal.message.updateStreamingSession, {
        sessionId,
        chunk: '',
        isComplete: true,
      });







      return assistantMessageId;
    } catch (error) {
      console.error('Groq streaming error:', error);



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
      // Ensure both observability clients are properly flushed

      await phClient.shutdown();
    }
  },
});
