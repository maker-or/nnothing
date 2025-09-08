'use node';


import { v } from 'convex/values';
import { getEmbedding } from "../utils/embeddings";
import { api, internal } from './_generated/api';
import { action } from './_generated/server';
import { withTracing } from "@posthog/ai"
import { PostHog } from 'posthog-node';
import { generateObject, tool,  streamText , generateText } from "ai";
import { z } from "zod";
import { createGroq } from '@ai-sdk/groq';
import { randomUUID } from 'crypto';
import { Pinecone } from "@pinecone-database/pinecone";



const MermaidSchema = z.object({
  language: z.string().describe("Programming language for the code"),
  code: z
    .string()
    .min(10)
    .describe("The actual code in the specified language"),
});



const KnowledgeSchema = z.object({
  information: z
    .string()
    .min(10)
    .describe("contains the information from the knowledge base"),
});







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



      const Mermaid = tool({
        description: "it is used to genrate the Mermaind diagrams",
        inputSchema: z.object({
          query: z.string().min(2).describe("Programming topic to get code for"),
        }),
        execute: async ({ query }) => {
          console.log(`🔍 TOOL CALL - Mermaid: ${query}`);

          const result = await generateObject({
            model: groqClient("openai/gpt-oss-120b"),
            schema: MermaidSchema,
            system:`you are a mermaid diagram generator , just provide the mermaid code for the given query , no more or no less , no unnecessary details details and explation
            <SystemPrompt>
              <Purpose>
                Guide the assistant to generate valid MermaidJS diagrams based on user instructions. Diagrams should be syntactically correct and use Mermaid best practices.
              </Purpose>
              <GeneralInstructions>
                <Instruction>Always start diagrams with a valid Mermaid type declaration (e.g., flowchart, sequenceDiagram, classDiagram, etc.).</Instruction>
                <Instruction>After the type, include diagram content that defines nodes, edges, relationships, or structure as needed.</Instruction>
                <Instruction>
                  Strictly follow Mermaid syntax. Only use supported diagram types and syntax. Typos or unsupported words will break rendering.
                </Instruction>
                <Instruction>Use concise, plain, and unambiguous code.</Instruction>
              </GeneralInstructions>
              <SupportedDiagramTypes>
                <DiagramType>flowchart</DiagramType>
                <DiagramType>sequenceDiagram</DiagramType>
                <DiagramType>classDiagram</DiagramType>
                <DiagramType>stateDiagram</DiagramType>
                <DiagramType>erDiagram</DiagramType>
                <DiagramType>gantt</DiagramType>
                <DiagramType>userJourney</DiagramType>
                <DiagramType>gitGraph</DiagramType>
                <DiagramType>quadrantChart</DiagramType>
                <DiagramType>req</DiagramType>
                <DiagramType>mindmap</DiagramType>
                <DiagramType>timeline</DiagramType>
                <DiagramType>pie</DiagramType>
                <DiagramType>sankey</DiagramType>
                <DiagramType>xyChart</DiagramType>
                <DiagramType>blockDiagram</DiagramType>
                <DiagramType>kanban</DiagramType>
                <DiagramType>architecture</DiagramType>
                <DiagramType>radar</DiagramType>
                <DiagramType>treemap</DiagramType>
                <DiagramType>packet</DiagramType>
              </SupportedDiagramTypes>
              <Configuration>
                <Frontmatter>
                  Use YAML frontmatter between <code>---</code> lines on top for title, theme, look, or layout configuration.
                  Example:
                  <![CDATA[
            ---
            title: Example Diagram
            config:
              theme: forest
              look: handDrawn
              layout: elk
            ---
            flowchart LR
              A[Start] --> B{Decision}
              B -->|Yes| C[Continue]
              B -->|No| D[Stop]
                  ]]>
                </Frontmatter>
                <Themes>Supported: default, forest, neutral, dark</Themes>
                <Looks>Supported: classic, handDrawn</Looks>
                <Layouts>dagre (default), elk (advanced, see docs for options)</Layouts>
              </Configuration>
              <SyntaxReminders>
                <Reminder>Use <code>%%</code> for comments. Do not use curly braces inside comments.</Reminder>
                <Reminder>Common breaking words like "end" must be quoted.</Reminder>
                <Reminder>Do not nest nodes inside other nodes; use quotes if needed for node names.</Reminder>
                <Reminder>Avoid advanced directives unless required.</Reminder>
                <Reminder>Keep code clean, minimal, well-structured, and valid as per the latest Mermaid docs.</Reminder>
              </SyntaxReminders>
            </SystemPrompt>
`,
            prompt: ` ${query} `,
          });
          return JSON.stringify(result.object);
        },
      });



      const Knowledgebase = tool({
        description: "it is used to genrate the Mermaind diagrams",
        inputSchema: z.object({
          query: z.string().min(2).describe("Programming topic to get code for"),
        }),
        execute: async ({ query }) => {
          console.log(`🔍 TOOL CALL - getCodeTools: ${query}`);

          const embeddings = await getEmbedding(
            allMessages.map((msg) => msg.content).join(" "),
          );


          const index = pinecone.index("bda");
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

          return resultsString;

        },
      });




      // Only search knowledge base if explicitly requested
      // if (args.useKnowledgeBase) {
      //   const embeddings = await getEmbedding(
      //     allMessages.map((msg) => msg.content).join(" "),
      //   );

      //   const index = pinecone.index("bda");
      //   const Semantic_search = await index.namespace("__default__").query({
      //     vector: embeddings,
      //     topK: 10,
      //     includeMetadata: true,
      //     includeValues: false,
      //   });

      //   const textContent = Semantic_search.matches
      //     .map((match) => match.metadata?.text)
      //     .filter(Boolean);
      //   console.log("the textcontent is : ", textContent);
      //   const resultsString = textContent.join("\n\n");
      //   console.log("############################################");
      //   console.log("the resultsString is : ", resultsString);
      //   console.log("############################################");
      //   // Add the retrieved context as a system message
      //   if (resultsString) {
      //     allMessages.unshift({
      //       role: "assistant",
      //       content: `Relevant context from knowledge base:\n\n${resultsString} when using this make sure that you also specify the sources at the end of the respose`,
      //     });
      //   }
      // }



const model = withTracing(groqClient("openai/gpt-oss-120b"), phClient, {
  posthogDistinctId: userId.subject,
  posthogTraceId: randomUUID(),
  posthogProperties: { "conversation_id": args.chatId, },
  posthogPrivacyMode: false,
});


      const response =  streamText({
        model: model,
        messages: allMessages,
        tools: {
          Mermaid,
        },
        providerOptions: {
            groq: {
              reasoningFormat: 'parsed',
              reasoningEffort: 'low',
              parallelToolCalls: true, // Enable parallel function calling (default: true)
              user: userId.subject, // Unique identifier for end-user (optional)
            },
          },

        system: `<SphereAIInstructions>
            <Purpose><![CDATA[
        You are SphereAI built by "HARSHITH", a friendly study assistant focused on exam readiness. Use provided knowledge base/context as the primary source. Keep everything simple first; use technical terms only when essential and define them in one short line. Most of the users are from global south like countries from India, Africa so try to maintain simple English.
        ]]></Purpose>



            <MathRules>
                <Rule>❌ NEVER use brackets like "[formula]" for math.</Rule>
                <Rule>❌ NEVER use parentheses like "(formula)" for math.</Rule>
                <Rule>❌ NEVER use plain text for mathematical expressions.</Rule>
                <DisplayMath>Use $$...$$ for complex equations, multi‑line formulas, and important standalone expressions.</DisplayMath>
                <InlineMath>Use $...$ for variables, simple expressions, and mathematical terms within sentences.</InlineMath>
            </MathRules>

            <Tools>
            You have access to the following tools :
            -> Mermaid
            -> Knowledgebase

            <Description>
            use the mermaid tool to create the diagram to visualize the process to help understand the problem and find a solution
            use the knowledgebase to find relevant information and resources
            </Description>
            </Tools>

            <Mermaid>
                <Rule>Use Mermaid diagrams whenever a diagram, chart, visual, UML, or design‑pattern explanation is appropriate or directly requested.</Rule>
                <Rule>Start each diagram with the diagram type (flowchart, sequenceDiagram, classDiagram, etc).</Rule>
                <Rule>Place all Mermaid code inside triple backticks with the language label MERMAID.</Rule>
                <Rule>Do NOT include Markdown formatting or code‑block markers inside the diagram code itself.</Rule>
                <Rule>Ensure no misspelled keywords, unknown words, bad YAML front‑matter, or malformed syntax.</Rule>
                <Rule>Wrap reserved words (e.g., “end”) in quotes if needed.</Rule>
                <Rule>Do NOT nest nodes inside nodes unless the diagram type permits it; otherwise, wrap in quotes.</Rule>
                <Rule>Comments: use only %% and avoid curly braces inside comments.</Rule>
                <Rule>Use correct arrow, edge, and label syntax per Mermaid documentation.</Rule>
                <Rule>Wrap text/label nodes in brackets when required by Mermaid syntax.</Rule>
                <Rule>Escape or wrap special characters/words as needed.</Rule>
                <Rule>If a diagram cannot be completed, give an explanatory message instead of partial code.</Rule>
            </Mermaid>
        </SphereAIInstructions>

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
        model: 'openai/gpt-oss-120b',
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
