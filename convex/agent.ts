"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { AgentOutputSchema } from "../src/app/SlidesSchema";
import { generateObject, tool, generateText, streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { google , createGoogleGenerativeAI} from '@ai-sdk/google';
import { Langfuse } from "langfuse";

import Exa from "exa-js";

export const agent = action({
  args: {
    courseId: v.id("Course"),
  },
  handler: async (ctx, args): Promise<any> => {

    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const course = await ctx.runQuery(api.course.getCourse, {
      courseId: args.courseId,
    });

    console.log("Agent received message sucessfully from the backend", course);

    // Get API key from environment
    const openRouterKey = process.env.OPENROUTER_API_KEY || "";
      const geminikey = process.env.GEMINI_API_KEY || '';
    if (!openRouterKey) {
      throw new Error(
        "OpenRouter API key is required. Please add your API key in settings.",
      );
    }

    if (!openRouterKey.startsWith("sk-")) {
      throw new Error(
        "Invalid OpenRouter API key format. Key should start with 'sk-'",
      );
    }

    if (!geminikey) {
      throw new Error(
        'geminikey from agent shyam API key is required. Please add your API key in settings.'
      );
    }

    // Create OpenRouter client
    const openrouter = createOpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
    });

    const google = createGoogleGenerativeAI({
      baseURL:"https://generativelanguage.googleapis.com/v1beta",
      apiKey:geminikey
    });

    const langfuse = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_BASEURL ?? "https://cloud.langfuse.com"
    });


    const tracedModel = (modelName: string, ctx: { userId: string; courseId: string }) => {
      console.log('tracedModel called with:', modelName);
      // Route google/gemini models via openrouter for main orchestrator

      console.log('Routing to GroqClient:', modelName);
      return google(modelName);
    };


    // Environment variables for external services
    const CX = process.env.GOOGLE_CX;
    const API_KEY = process.env.GOOGLE_SEARCH;
    const EXA_API_KEY = process.env.EXA_API_KEY;

    // Define schemas for structured outputs
    const GetCodeSchema = z.object({
      language: z.string().describe("Programming language for the code"),
      code: z
        .string()
        .min(10)
        .describe("The actual code in the specified language"),
      explanation: z.string().describe("Explanation of the code"),
    });

    const GetSyllabusSchema = z.object({
      query: z
        .string()
        .min(2)
        .describe("The subject or concept for the syllabus"),
      syllabus: z.object({
        previousConcepts: z.array(z.string()).describe("Prerequisite concepts"),
        currentConcepts: z
          .array(
            z.object({
              topic: z.string().describe("Main topic"),
              subtopics: z
                .array(z.string())
                .describe("Subtopics under this topic"),
            }),
          )
          .describe("Current concepts to learn"),
      }),
    });

    const SvgGenerationSchema = z.object({
      svg: z.string().describe("This must the code for SVG"),
    });

    const TestQuestionSchema = z.object({
      questions: z.array(
        z.object({
          question: z.string().describe("The actual question"),
          options: z
            .array(z.string())
            .length(4)
            .describe("Four answer options"),
          answer: z.string().describe("The correct answer"),
        }),
      ),
    });

    const FlashcardSchema = z.object({
      flashcards: z.array(
        z.object({
          front: z.string().describe("Question or concept for the front"),
          back: z.string().describe("Summary or explanation for the back"),
        }),
      ),
    });

    // Define tools using Vercel AI SDK - Fixed inputSchema to inputSchema
    const getSyllabusTools = tool({
      description: "Get the syllabus for a course or subject",
      inputSchema: z.object({
        query: z.string().min(2).describe("The subject to get syllabus for"),
      }),
      execute: async ({ query }) => {
        console.log("Getting syllabus for:", query);

        // Use OpenRouter with structured output
        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: GetSyllabusSchema,
          prompt: `Generate a comprehensive syllabus for ${query}. Include prerequisite concepts and current concepts with topics and subtopics.`,
        });

        return JSON.stringify(result.object);
      },
    });



    const webSearchTools = tool({
      description: "Search the web for information about a topic",
      inputSchema: z.object({
        query: z.string().min(2).describe("Query to search for"),
      }),
      execute: async ({ query }) => {
        console.log("Web searching for:", query);

        if (!EXA_API_KEY) {
          return JSON.stringify({ error: "EXA API key not configured" });
        }

        try {
          const exa = new Exa(EXA_API_KEY);
          const response = await exa.searchAndContents(query, {
            type: "neural",
            numResults: 5,
            text: true,
          });

          return JSON.stringify({
            query,
            results: response.results.map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.text?.substring(0, 500) + "...",
            })),
          });
        } catch (error) {
          console.error("Web search error:", error);
          return JSON.stringify({
            error: true,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        }
      },
    });

    const knowledgeSearchTools = tool({
      description: "Search the knowledge base for information",
      inputSchema: z.object({
        query: z.string().min(2).describe("Query to search knowledge base"),
      }),
      execute: async ({ query }) => {
        console.log("Knowledge searching for:", query);
        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: GetCodeSchema,
          prompt: ` ${query}`,
        });

        return result.object;
      },
    });

    const getCodeTools = tool({
      description: "Get code examples for programming topics",
      inputSchema: z.object({
        query: z.string().min(2).describe("Programming topic to get code for"),
        language: z.string().min(1).describe("Programming language"),
      }),
      execute: async ({ query, language }) => {
        console.log("Getting code for:", query, "in", language);

        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: GetCodeSchema,
          prompt: `Generate code for ${query} in ${language}. Include the code and a clear explanation.`,
        });

        return JSON.stringify(result.object);
      },
    });

    const testTools = tool({
      description: "Generate test questions on a topic",
      inputSchema: z.object({
        topic: z.string().min(1).describe("Topic for test questions"),
        no: z.number().min(1).max(10).describe("Number of questions"),
      }),
      execute: async ({ topic, no }) => {
        console.log("Generating test for:", topic, "with", no, "questions");

        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: TestQuestionSchema,
          system: `You are a world-class test generator. Your job is to create comprehensive tests based
          on the provided topic. Remember that students will use these tests for exam preparation, so ensure
          they cover all essential aspects of the subject matter.Always adhere precisely to the provided schema. `,
          prompt: `Create ${no} multiple choice questions on the topic ${topic}. Each question
          should have exactly 4 options with one correct answer.`,
        });

        return result.object;
      },
    });

    const svgTool = tool({
      description:
        "this tool is usefull to create visual represent the context by creating a SVG  diagram of that",
      inputSchema: z.object({
        Query: z.string(),
      }),
      execute: async ({ Query }) => {
        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: SvgGenerationSchema,
          system: `Your role is to generate minimalist SVG code based on the provided prompt or description.
          The SVG will be displayed on a black background, so prioritize high contrast and accessibility in
          your design choices. Output strictly the SVG markup; do not include any explanations, comments, or additional text.
          Always adhere precisely to the provided schema, The SVG must be horizontally oriented and designed to fill half the screen width on a laptop display, with any appropriate height.`,
          prompt: `${Query}`,
        });
        return result.object;
      },
    });

    const flashcardsTools = tool({
      description: "Create flashcards for studying a topic",
      inputSchema: z.object({
        query: z.string().min(2).describe("Topic for flashcards"),
        no: z.number().min(1).max(3).describe("Number of flashcards"),
      }),
      execute: async ({ query, no }) => {
        console.log("Creating flashcards for:", query, "count:", no);

        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: FlashcardSchema,
          prompt: `Generate ${no} flashcards on the topic ${query}. Each flashcard should have a clear question/concept on the front and a concise answer/explanation on the back.`,
        });

        return JSON.stringify(result.object);
      },
    });
    // now we start the proccess of sending each stage into your AI agent which in return genrates the slides

    const stages = course.course?.stages;
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error("No stages found for the course.");
    }

    const stageIds = [];

    for (const stage of stages) {
      const stagePrompt = `You are SphereAI, an advanced educational agent. Your mission is to produce a comprehensive, multi-slide learning module for the following stage of a course:
        Title: ${stage.title}
      Purpose: ${stage.purpose}
      Topics: ${stage.include.join(", ")}
      Outcome: ${stage.outcome}
      Discussion area: ${stage.discussion_prompt || ""}`;
      try {
        // Use streamText with tools for better debugging and control
        const streamResult = streamText({
          model: google('gemini-2.5-flash'),
// Allow multiple steps for tool usage and final generation
        system: `You are SphereAI, an advanced educational agent. Your mission is to produce a comprehensive, multi-slide learning module for any topic a student asks about.

        CRITICAL: You MUST follow this exact workflow:

        PHASE 1 - INFORMATION GATHERING (Steps 1-10):
        Use your available tools strategically (don't use all tools at once):
        1. Use "getSyllabusTools" to get a detailed syllabus
        2. Use "webSearchTools" for 1-2 targeted searches (not exhaustive)
        3. Use "getCodeTools" if the topic involves programming
        4. Use "svgTool" for 1-2 key visual diagrams
        5. Use "flashcardsTools" for core concepts (max 3 flashcards)
        6. Use "testTools" for assessment questions (max 5 questions)

        PHASE 2 - SYNTHESIS AND RESPONSE (Steps 11-15):
        After gathering tool results, you MUST:
        1. Analyze all the tool results you received
        2. Synthesize the information into a coherent learning experience
        3. Generate a comprehensive text response explaining the learning module
        4. Format everything into the required JSON structure

        MANDATORY: Your final response must contain BOTH explanatory text AND a valid JSON object that matches this structure:
          {
            "slides": [
              {
                "name": "slide 1",
                "title": "Main title of the slide",
                "subTitles": "Brief subtitle or summary",
                "svg": "<svg>...</svg>",
                "content": "Main explanation in markdown (max 180 words)",
                "links": ["https://example.com/resource1", "https://example.com/resource2"],
                "youtubeSearchText": "Search query for YouTube exploration",
                "code": {
                  "language": "javascript",
                  "content": "console.log('Hello World');"
                },
                "tables": "Optional table in markdown format",
                "bulletPoints": ["Key point 1", "Key point 2"],
                "flashcardData": [
                  {
                    "question": "What is X?",
                    "answer": "X is..."
                  }
                ],
                "testQuestions": [
                  {
                    "question": "What is the correct answer?",
                    "options": ["A", "B", "C", "D"],
                    "answer": "A"
                  }
                ],
                "type": "markdown"
              }
            ]
          }

          IMPORTANT: You must use the results from your tool calls to populate the fields:
          - Use SVG diagrams from svgTool results for the "svg" field
          - Use flashcard data from flashcardsTools results for the "flashcardData" field
          - Use test questions from testTools results for the "testQuestions" field
          - Use code examples from getCodeTools results for the "code" field
          - Generate SVG diagrams that are relevant to the topic and enhance understanding
          - You don't need to show SVG diagrams for test slides, flashcard slides, table slides, or code slides
          - Focus on creating SVG diagrams that visually represent concepts, processes, or structures
          - always make sure that you render the test and flash card in the new slide, so that we can provide better learning experience
          - always remember to keep the user experience high so structure the content in a way that is easy to understand and follow
          - When creating test questions, always create a dedicated slide with type "test" for the test questions
          - When creating flashcards, always create a dedicated slide with type "flashcard" for the flashcards
          - Structure the content so that test questions and flashcards are on separate slides from the main content

          FINAL REQUIREMENT: You MUST NOT end with just tool calls. After using tools, you MUST generate a final comprehensive text response that:
          1. Summarizes what you learned from the tools
          2. Explains the learning module structure
          3. Presents a complete JSON object with all gathered information

          If you finish without generating final text, you have FAILED your mission.`,
          prompt: stagePrompt,
          tools: {
            getSyllabusTools,
            webSearchTools,
            knowledgeSearchTools,
            getCodeTools,
            testTools,
            flashcardsTools,
            svgTool,
          },
          onChunk({ chunk }) {
            console.log(`Chunk type: ${chunk.type}`);

            // Generic chunk inspection to avoid TypeScript errors
            const chunkAny = chunk as any;

            switch (chunk.type) {
              case 'text-delta':
                if (chunkAny.textDelta) {
                  console.log(`Text delta: "${chunkAny.textDelta}"`);
                }
                break;

              case 'tool-call':
                console.log(`Tool call detected`);
                if (chunkAny.toolName) {
                  console.log(`  Tool name: ${chunkAny.toolName}`);
                }
                if (chunkAny.input) {
                  console.log(`  Input:`, chunkAny.input);
                }
                if (chunkAny.args) {
                  console.log(`  Args:`, chunkAny.args);
                }
                break;

              case 'tool-result':
                console.log(`Tool result detected`);
                if (chunkAny.toolName) {
                  console.log(`  Tool name: ${chunkAny.toolName}`);
                }
                const result = chunkAny.result || chunkAny.toolResult || chunkAny.data;
                if (result) {
                  console.log(`  Result type: ${typeof result}`);
                  if (typeof result === 'string') {
                    console.log(`  Result preview: ${result.substring(0, 200)}...`);
                  } else {
                    console.log(`  Result data:`, JSON.stringify(result, null, 2).substring(0, 500));
                  }
                } else {
                  console.log(`  No result data found`);
                }
                break;

              default:
                // Log any other chunk types with their available properties
                console.log(`Other chunk type: ${chunk.type}`);
                console.log(`Available properties:`, Object.keys(chunkAny));
                break;
            }
          },
          onFinish({ text, toolCalls, toolResults, steps, finishReason, usage }) {
            console.log('=== STREAM FINISHED ===');
            console.log(`Final text length: ${text?.length || 0}`);
            console.log(`Tool calls: ${toolCalls?.length || 0}`);
            console.log(`Tool results: ${toolResults?.length || 0}`);
            console.log(`Steps: ${steps?.length || 0}`);
            console.log(`Finish reason: ${finishReason}`);
            console.log(`Usage:`, usage);

            // Log detailed tool results
            if (toolResults && toolResults.length > 0) {
              console.log('=== DETAILED TOOL RESULTS ===');
              console.log('Raw tool results structure:', JSON.stringify(toolResults, null, 2));
              toolResults.forEach((toolResult, index) => {
                // Defensive access for tool result properties
                const resultData = (toolResult as any).result || (toolResult as any).data || (toolResult as any).output;
                const toolName = (toolResult as any).toolName || `Tool${index + 1}`;

                console.log(`Tool ${index + 1}: ${toolName}`);
                if (typeof resultData === 'string') {
                  console.log(`  Result (string): ${resultData.substring(0, 300)}...`);
                } else if (resultData) {
                  console.log(`  Result (object):`, JSON.stringify(resultData, null, 2));
                } else {
                  console.log(`  Result: No data found`);
                  console.log(`  Available properties:`, Object.keys(toolResult));
                }
              });
            }

            // Log step details if available
            if (steps && steps.length > 0) {
              console.log('=== STEP DETAILS ===');
              steps.forEach((step, index) => {
                console.log(`Step ${index + 1}:`);
                console.log(`  Text length: ${step.text?.length || 0}`);
                console.log(`  Tool calls: ${step.toolCalls?.length || 0}`);
                console.log(`  Tool results: ${step.toolResults?.length || 0}`);
                console.log(`  Finish reason: ${step.finishReason || 'none'}`);
                if (step.text && step.text.length > 0) {
                  console.log(`  Text preview: ${step.text.substring(0, 200)}...`);
                }
              });
            }
          },
          onError({ error }) {
            console.error('Stream error:', error);
          }
        });

        // Wait for the stream to complete and get final results
        const finalText = await streamResult.text;
        const toolCalls = await streamResult.toolCalls;
        const toolResults = await streamResult.toolResults;
        const steps = await streamResult.steps;
        const finishReason = await streamResult.finishReason;
        const usage = await streamResult.usage;

        // Handle case where model stops at tool-calls without generating final text
        let synthesizedText = finalText;
        if (finishReason === 'tool-calls' && (!finalText || finalText.trim().length === 0)) {
          console.log("🔄 MODEL STOPPED AT TOOL-CALLS - FORCING SYNTHESIS CONTINUATION");

          if (toolResults && toolResults.length > 0) {
            // Create synthesis prompt from tool results
            const toolSummaryForSynthesis = toolResults.map((toolResult, index) => {
              const toolName = (toolResult as any).toolName || `Tool${index + 1}`;
              const resultData = (toolResult as any).result || (toolResult as any).data || (toolResult as any).output;

              if (typeof resultData === 'string') {
                return `${toolName}: ${resultData}`;
              } else if (resultData) {
                return `${toolName}: ${JSON.stringify(resultData, null, 2)}`;
              }
              return `${toolName}: No data`;
            }).join('\n\n');

            // Force synthesis with a direct continuation call
            console.log("🚀 STARTING SYNTHESIS PHASE...");
            const synthesisResult = streamText({
              model: google('gemini-2.5-flash'),


              system: `You are completing a learning module generation task. You have already gathered information using tools, and now you MUST synthesize this information into a final response.

              CRITICAL: You must generate a comprehensive text response that explains the learning module and includes a complete JSON structure. DO NOT make any more tool calls - just synthesize the existing information.`,
              prompt: `Based on the following tool results, create a comprehensive learning module response for "${stage.title}":

${toolSummaryForSynthesis}

Your response must include:
1. An explanation of what the learning module covers
2. How the different components work together
3. A complete JSON structure with all the slides

Generate a complete, detailed response now.`,
            });

            synthesizedText = await synthesisResult.text;
            console.log(`✅ SYNTHESIS COMPLETE - Generated ${synthesizedText?.length || 0} characters`);
          }
        }

        console.log("########################################################")
        console.log("Final text:", synthesizedText);
        console.log("Final text length:", synthesizedText?.length || 0);
        console.log("Original finish reason:", finishReason);
        console.log("Tool calls count:", toolCalls?.length || 0);
        console.log("Tool results count:", toolResults?.length || 0);
        console.log("Steps count:", steps?.length || 0);
        console.log("Finish reason:", finishReason);
        console.log("########################################################")

        // Debug actual structure of results
        console.log("=== RAW RESULTS INSPECTION ===");
        console.log("Tool results type:", typeof toolResults);
        console.log("Tool results array?:", Array.isArray(toolResults));
        if (toolResults && toolResults.length > 0) {
          console.log("First tool result keys:", Object.keys(toolResults[0]));
          console.log("First tool result:", JSON.stringify(toolResults[0], null, 2));
        }

        // Additional debugging for empty text cases
        if (!finalText || finalText.trim().length === 0) {
          console.log("=== EMPTY TEXT ANALYSIS ===");
          console.log("Final text is empty or whitespace only");
          console.log("Checking steps for any text content...");

          if (steps && steps.length > 0) {
            steps.forEach((step, index) => {
              if (step.text && step.text.trim().length > 0) {
                console.log(`Step ${index + 1} has text:`, step.text.substring(0, 100));
              }
            });
          }
        }

        // Enhanced fallback: if no final text but we have tool results, construct response from tools
        let textToProcess = synthesizedText;
        if (!synthesizedText || synthesizedText.trim().length === 0) {
          console.log("❌ MODEL FAILED TO GENERATE FINAL TEXT - ACTIVATING FALLBACK");

          if (toolResults && toolResults.length > 0) {
            console.log(`Processing ${toolResults.length} tool results for fallback response`);

            // Create a comprehensive response from all tool results
            const toolSummary = toolResults.map((toolResult, index) => {
              // Defensive access for tool result properties
              const toolName = (toolResult as any).toolName || `Tool${index + 1}`;
              const resultData = (toolResult as any).result || (toolResult as any).data || (toolResult as any).output;

              let toolData;
              if (typeof resultData === 'string') {
                toolData = resultData;
              } else if (resultData) {
                toolData = JSON.stringify(resultData, null, 2);
              } else {
                toolData = 'No result data available';
              }

              return `=== ${toolName.toUpperCase()} RESULTS ===\n${toolData}`;
            }).join('\n\n');

            textToProcess = `# Learning Module: ${stage.title}

## Overview
This comprehensive learning module was created based on extensive research and content generation. Below is all the gathered information that needs to be formatted into educational slides.

## Purpose
${stage.purpose}

## Learning Outcomes
${stage.outcome}

## Content Details
${toolSummary}

## Instructions for Formatting
Please structure this information into a comprehensive JSON learning module with multiple slides covering:
1. Introduction and overview slides
2. Core concept slides with explanations
3. Visual diagram slides (using the generated SVGs)
4. Code example slides (if applicable)
5. Interactive flashcard slides
6. Assessment/quiz slides

Ensure each slide has appropriate content, maintains educational flow, and provides a rich learning experience.`;
          } else {
            console.log("❌ NO TOOL RESULTS AVAILABLE - USING MINIMAL FALLBACK");
            textToProcess = `# Learning Module: ${stage.title}

## Request Details
- Title: ${stage.title}
- Purpose: ${stage.purpose}
- Topics to include: ${stage.include.join(", ")}
- Expected outcome: ${stage.outcome}

## Instructions
Create a comprehensive learning module with multiple educational slides covering the above topic. Include:
- Introductory content explaining the subject
- Core concepts broken down into digestible parts
- Visual diagrams where appropriate
- Practical examples or code snippets if relevant
- Interactive elements like flashcards
- Assessment questions to test understanding

Structure this as engaging educational content suitable for learners at various levels.`;
          }
        }

        console.log("=== TEXT TO PROCESS ===");
        console.log(`Text length: ${textToProcess?.length || 0}`);
        console.log(`Text preview: ${textToProcess?.substring(0, 300)}...`);

        const result = await generateObject({
          model: google('gemini-2.5-flash'),
          schema: AgentOutputSchema,
          maxRetries: 3,
          prompt: `Create a comprehensive learning module by formatting the following information into the valid schema.

CONTENT TO PROCESS:
${textToProcess}

REQUIREMENTS:
- Create multiple engaging slides (minimum 5, maximum 15)
- Include diverse slide types: content, visual, interactive, assessment
- Use any SVG diagrams that were generated in appropriate slides
- Include flashcards and quiz questions in dedicated slides
- Ensure educational progression and flow
- Make content accessible and engaging
- Fill in any missing information with educationally appropriate content`,
          system: `You are an educational content formatter. Your task is to convert raw educational information into a structured learning module.

CRITICAL REQUIREMENTS:
1. Create a comprehensive set of slides that tell a complete educational story
2. Use ALL available information from the provided content
3. Infer and add appropriate educational content where needed
4. Ensure each slide has substantive, valuable content
5. Create proper educational flow from introduction to assessment
6. Use appropriate slide types for different content (markdown, flashcard, test, etc.)
7. Make the content engaging and learner-friendly
8. NEVER create empty or placeholder slides

Your output must strictly follow the provided schema structure.`
        });

        console.log("=== GENERATE OBJECT RESULT ===");
        console.log("Generated object keys:", Object.keys(result.object));
        if (result.object.slides) {
          console.log(`Generated slides count: ${result.object.slides.length}`);
          result.object.slides.forEach((slide, index) => {
            console.log(`Slide ${index + 1}: ${slide.title || 'No title'} (type: ${slide.type || 'undefined'})`);
          });
        }
        console.log("Full result object:", JSON.stringify(result.object, null, 2).substring(0, 1000));



        const parsed = AgentOutputSchema.safeParse(result.object);
        if (!parsed.success) {
          console.error("Invalid structured output:", parsed.error.format());
          console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")
          console.log(
            "Raw structured output:",
            JSON.stringify(result.object, null, 2),
          );
          console.log("@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@")

          // Log specific field errors for debugging
          if (parsed.error.issues) {
            console.error("Validation issues:", parsed.error.issues);
          }

          throw new Error("Agent returned invalid structured content.");
        }

        const stageId = await ctx.runMutation(api.stage.createstage, {
          courseId: args.courseId,
          title: stage.title,
          slides: parsed.data.slides,
        });
        stageIds.push(stageId);
      } catch (error) {
        console.error("Agent processing error:", error);
      }
    }

    return stageIds;
  },
});
