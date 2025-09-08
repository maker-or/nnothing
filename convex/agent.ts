"use node";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { AgentOutputSchema } from "../src/app/SlidesSchema";
import { generateObject, tool,  streamText , generateText } from "ai";
import { z } from "zod";
import { createGoogleGenerativeAI} from '@ai-sdk/google';
import { randomUUID } from 'crypto';
import { withTracing } from "@posthog/ai"
import { PostHog } from 'posthog-node';
import { createMermaidMcp } from '../src/mcp/mermaid';

import Exa from "exa-js";

export const agent = action({
  args: {
    courseId: v.id("Course"),
    traceId: v.optional(v.string()),
    runId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {

    const userId = await ctx.auth.getUserIdentity();
    if (!userId) throw new Error("Not authenticated");

    const course = await ctx.runQuery(api.course.getCourse, {
      courseId: args.courseId,
    });

    // Extract trace metadata from args or generate new ones
    const traceId = args.traceId || randomUUID();
    const runId = args.runId || randomUUID();

    // Validate trace continuity
    if (args.traceId) {
      console.log(`🔗 TRACE CONTINUITY - Received trace_id: ${traceId} from context gathering`);
    } else {
      console.log(`⚠️ TRACE WARNING - No trace_id provided, generated new one: ${traceId}`);
    }

    console.log(`🟢 AGENT PIPELINE - Starting with course ID: ${args.courseId}, trace_id: ${traceId}, run_id: ${runId}`);
    console.log("Agent received message sucessfully from the backend", course);
    const geminikey = process.env.GEMINI_API_KEY || '';

    if (!geminikey) {
      throw new Error(
        'geminikey from agent shyam API key is required. Please add your API key in settings.'
      );
    }


    const google = createGoogleGenerativeAI({
      baseURL:"https://generativelanguage.googleapis.com/v1beta",
      apiKey:geminikey
    });

    const phClient = new PostHog(process.env.POSTHOG_API_KEY!, {
      host: process.env.PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
    });

    // Create shared tracing context for the agent pipeline
    const tracingContext = {
      posthogDistinctId: userId.subject,
      posthogTraceId: traceId,
      posthogProperties: {
        "pipeline_stage": "agent_processing",
        "user_id": userId.subject,
        "run_id": runId,
        "course_id": args.courseId,
        "course_creation_flow": true,
      },
      posthogPrivacyMode: false,
    };

    const tracedModel = (modelName: string, additionalProperties: Record<string, any> = {}) => {
      const enhancedContext = {
        ...tracingContext,
        posthogProperties: {
          ...tracingContext.posthogProperties,
          ...additionalProperties,
          "model_name": modelName,
        }
      };
      console.log(`🔄 AGENT - Creating traced model: ${modelName} with trace_id: ${traceId}`);
      return withTracing(google(modelName), phClient, enhancedContext);
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


    const MermaidSchema = z.object({
      code: z
        .string()
        .min(10)
        .describe("The actual code in the mermaid specifed syntax"),
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
        console.log(`🔍 TOOL CALL - getSyllabusTools: ${query}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'getSyllabusTools',
            tool_input: { query },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });



        const result = await generateObject({
          model: tracedModel('gemini-2.5-flash', { tool_name: 'getSyllabusTools', tool_query: query }),
          schema: GetSyllabusSchema,
          prompt: `Generate a comprehensive syllabus for ${query}. Include prerequisite concepts and current concepts with topics and subtopics.`,
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'getSyllabusTools',
            tool_input: { query },
            tool_output_size: JSON.stringify(result.object).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - getSyllabusTools completed for: ${query}`);

        return JSON.stringify(result.object);
      },
    });

    // Mermaid tool using MCP client
    //
    const mcp = await createMermaidMcp();
    const tools = await mcp.tools();


    const MermaidTool = tool({
      description: "Mermaid diagram generation tool",
      inputSchema: z.object({
        query: z.string().min(2).describe("Clearly describe about the diagram you want to create, the intent and the purpose of the diagram, and the required information to create the diagram , always try to be more specific so that we can get the better result"),
      }),
      execute: async ({ query }) => {
        console.log(`🔍 TOOL CALL - MermaidTool: ${query}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'MermaidTool',
            tool_input: { query },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateText({
          model: tracedModel('gemini-2.5-flash', { tool_name: 'MermaidTool', tool_query: query }),
          tools:tools,
          system: `
          <SystemInstruction>
            <Role>
              You are a diagram-and-chart generation agent.
            </Role>


            <OperatingPrinciple>
              The ONLY way to generate any Mermaid diagram is to call the matching specialized tool for that graph.
              <ExplicitToolUsage>
                For every diagram type, use only its associated tool. Do NOT generate Mermaid code directly; tool calls are mandatory for all chart types.
              </ExplicitToolUsage>
            </OperatingPrinciple>


            <Capabilities>
              <ProduceMermaid>
                Produce valid Mermaid syntax by invoking the correct tool for the required diagram type.
              </ProduceMermaid>
              <ToolMandatory>
                Each chart/diagram type has a dedicated tool. Always use the tool; never create Mermaid syntax directly or as fallback.
              </ToolMandatory>
            </Capabilities>

            <Objectives>
              <Intent>
                Always infer the user's intended visualization type and required data.
              </Intent>
              <Truthfulness>
                Create the clearest, minimal, and truthful diagram by invoking the correct tool, the create diagram will be showed on the dark background so keep the accesability in check.
              </Truthfulness>
            </Objectives>

            <DataPolicy>
              <SampleData>
                If required data or components are missing, synthesize reasonable sample data . Then proceed to call the correct tool.
              </SampleData>
              <NoHandwrittenMermaid>
                Never emit Mermaid code except as returned by a tool.
              </NoHandwrittenMermaid>
            </DataPolicy>


            <Toolbox>
              <Tool name="generate_area_chart" when="Continuous trends or cumulative magnitude (area chart)." />
              <Tool name="generate_bar_chart" when="Categorical comparisons, horizontal layout." />
              <Tool name="generate_boxplot_chart" when="Distribution summaries across groups (boxplot)." />
              <Tool name="generate_column_chart" when="Vertical categorical comparison (column chart)." />
              <Tool name="generate_district_map" when="Choropleth or region-based map (district map)." />
              <Tool name="generate_dual_axes_chart" when="Two related series with dual axes." />
              <Tool name="generate_fishbone_diagram" when="Root cause (Ishikawa) analysis (fishbone diagram)." />
              <Tool name="generate_flow_diagram" when="Processes, logic, or workflow (flowchart)." />
              <Tool name="generate_funnel_chart" when="Stage-by-stage dropoff (funnel chart)." />
              <Tool name="generate_histogram_chart" when="Distribution by bins (histogram)." />
              <Tool name="generate_line_chart" when="Trends over time/continuous (line chart)." />
              <Tool name="generate_liquid_chart" when="Single KPI/metric with fill gauge (liquid chart)." />
              <Tool name="generate_mind_map" when="Hierarchical/radial ideas (mind map)." />
              <Tool name="generate_network_graph" when="Relationships/connections (network graph)." />
              <Tool name="generate_organization_chart" when="Org structure/hierarchies (org chart)." />
              <Tool name="generate_path_map" when="Route/path on a map (path map)." />
              <Tool name="generate_pie_chart" when="Part-to-whole, few slices (pie chart)." />
              <Tool name="generate_pin_map" when="POI markers on a map (pin map)." />
              <Tool name="generate_radar_chart" when="Multi-metric comparison (radar chart)." />
              <Tool name="generate_sankey_chart" when="Flows with magnitude (sankey chart)." />
              <Tool name="generate_scatter_chart" when="Relationship between numeric variables (scatter plot)." />
              <Tool name="generate_treemap_chart" when="Hierarchical part-to-whole (treemap)." />
              <Tool name="generate_venn_chart" when="Set intersections (venn diagram)." />
              <Tool name="generate_violin_chart" when="Distribution + density (violin plot)." />
              <Tool name="generate_word_cloud_chart" when="Word frequency emphasis (word cloud)." />
            </Toolbox>


            <SelectionHeuristics>
              <ChartSelection>
                Always select the single correct tool for the user’s intent. One chart/diagram = one tool call.
              </ChartSelection>
            </SelectionHeuristics>


            <OutputPolicy>


              <MermaidViaToolOnly>
                Never hand-type or return Mermaid without a tool. The tool’s result is the only legal output.
              </MermaidViaToolOnly>

              <OneToolOneChart>
                Never combine tool calls or cherry-pick chart code. Each invocation = one diagram.
              </OneToolOneChart>

            </OutputPolicy>


            <QuickExamples>
              <Example name="Process flow">Call <ToolRef name="generate_flow_diagram" /> and return ONLY its Mermaid output.</Example>
              <Example name="Sales funnel">Call <ToolRef name="generate_funnel_chart" /> with the sales stages and counts.</Example>
              <Example name="Team org chart">Call <ToolRef name="generate_organization_chart" /> with the hierarchy data.</Example>
              <Example name="Product comparisons">Call <ToolRef name="generate_bar_chart" /> with category labels and values.</Example>
            </QuickExamples>


            <DoNots>
              <NoManualMermaid>Never write Mermaid by hand, never return it unless from a tool.</NoManualMermaid>
              <NoMultiTool>Never use more than one tool per chart.</NoMultiTool>
              <NoFallback>No tool ever acts as a backup; each is required for its chart type.</NoFallback>
            </DoNots>
          </SystemInstruction>

`,
          prompt: ` ${query}`,

          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: -1,
                includeThoughts: false,
              },
            },
          },
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'getSyllabusTools',
            tool_input: { query },
            tool_output_size: JSON.stringify(result.text).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - getSyllabusTools completed for: ${query}`);

        return JSON.stringify(result.text);
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

        console.log(`🔍 TOOL CALL - webSearchTools: ${query}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'webSearchTools',
            tool_input: { query },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        try {
          const exa = new Exa(EXA_API_KEY);
          const response = await exa.searchAndContents(query, {
            type: "neural",
            numResults: 5,
            text: true,
          });

          const result = JSON.stringify({
            query,
            results: response.results.map((r: any) => ({
              title: r.title,
              url: r.url,
              content: r.text?.substring(0, 500) + "...",
            })),
          });

          // Track tool call completion
          phClient.capture({
            distinctId: userId.subject,
            event: 'agent_tool_call_completed',
            properties: {
              trace_id: traceId,
              run_id: runId,
              tool_name: 'webSearchTools',
              tool_input: { query },
              tool_output_size: result.length,
              results_count: response.results.length,
              course_id: args.courseId,
              pipeline_stage: 'agent_processing'
            }
          });

          console.log(`✅ TOOL RESULT - webSearchTools completed: ${response.results.length} results for ${query}`);
          return result;
        } catch (error) {
          console.error(`❌ TOOL ERROR - webSearchTools failed for ${query}:`, error);

          // Track tool call error
          phClient.capture({
            distinctId: userId.subject,
            event: 'agent_tool_call_failed',
            properties: {
              trace_id: traceId,
              run_id: runId,
              tool_name: 'webSearchTools',
              tool_input: { query },
              error_message: error instanceof Error ? error.message : "Unknown error",
              course_id: args.courseId,
              pipeline_stage: 'agent_processing'
            }
          });

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
        console.log(`🔍 TOOL CALL - knowledgeSearchTools: ${query}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'knowledgeSearchTools',
            tool_input: { query },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateObject({
          model: tracedModel('gemini-2.5-flash', { tool_name: 'knowledgeSearchTools', tool_query: query }),
          schema: GetCodeSchema,
          prompt: ` ${query}`,
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'knowledgeSearchTools',
            tool_input: { query },
            tool_output_size: JSON.stringify(result.object).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - knowledgeSearchTools completed for: ${query}`);

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
        console.log(`🔍 TOOL CALL - getCodeTools: ${query} in ${language}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'getCodeTools',
            tool_input: { query, language },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateObject({
          model: tracedModel('gemini-2.5-flash', { tool_name: 'getCodeTools', tool_query: query, tool_language: language }),
          schema: GetCodeSchema,
          prompt: `Generate code for ${query} in ${language}. Include the code and a clear explanation.`,
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'getCodeTools',
            tool_input: { query, language },
            tool_output_size: JSON.stringify(result.object).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - getCodeTools completed for: ${query} in ${language}`);

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
        console.log(`🔍 TOOL CALL - testTools: ${topic} with ${no} questions`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'testTools',
            tool_input: { topic, no },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateObject({
          model: tracedModel('gemini-2.5-flash', { tool_name: 'testTools', tool_topic: topic, tool_question_count: no }),
          schema: TestQuestionSchema,
          system: `You are a world-class test generator. Your job is to create comprehensive tests based
          on the provided topic. Remember that students will use these tests for exam preparation, so ensure
          they cover all essential aspects of the subject matter.Always adhere precisely to the provided schema. `,
          prompt: `Create ${no} multiple choice questions on the topic ${topic}. Each question
          should have exactly 4 options with one correct answer.`,
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'testTools',
            tool_input: { topic, no },
            tool_output_questions: result.object.questions.length,
            tool_output_size: JSON.stringify(result.object).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - testTools completed: ${result.object.questions.length} questions for ${topic}`);

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
        console.log(`🔍 TOOL CALL - svgTool: ${Query}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'svgTool',
            tool_input: { Query },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateObject({
          model: tracedModel('gemini-2.5-pro', { tool_name: 'svgTool', tool_query: Query }),
          schema: SvgGenerationSchema,
          system: `IMPORTANT: You must use the results from your tool calls to populate the fields:
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
          prompt: `${Query}`,
          providerOptions: {
            google: {
              thinkingConfig: {
                thinkingBudget: -1,
                includeThoughts: false,
              },
            },
          },
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'svgTool',
            tool_input: { Query },
            tool_output_size: JSON.stringify(result.object).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - svgTool completed for: ${Query}`);
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
        console.log(`🔍 TOOL CALL - flashcardsTools: ${query} count: ${no}`);

        // Track tool call start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'flashcardsTools',
            tool_input: { query, no },
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateObject({
          model: tracedModel('gemini-2.5-flash', { tool_name: 'flashcardsTools', tool_query: query, tool_flashcard_count: no }),
          schema: FlashcardSchema,
          prompt: `Generate ${no} flashcards on the topic ${query}. Each flashcard should have a clear question/concept on the front and a concise answer/explanation on the back.`,
        });

        // Track tool call completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_tool_call_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            tool_name: 'flashcardsTools',
            tool_input: { query, no },
            tool_output_flashcards: result.object.flashcards.length,
            tool_output_size: JSON.stringify(result.object).length,
            course_id: args.courseId,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ TOOL RESULT - flashcardsTools completed: ${result.object.flashcards.length} flashcards for ${query}`);

        return JSON.stringify(result.object);
      },
    });
    // now we start the proccess of sending each stage into your AI agent which in return genrates the slides

    const stages = course.course?.stages;
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new Error("No stages found for the course.");
    }

    const stageIds = [];

    // Track agent processing start
    phClient.capture({
      distinctId: userId.subject,
      event: 'agent_stage_processing_started',
      properties: {
        trace_id: traceId,
        run_id: runId,
        course_id: args.courseId,
        total_stages: stages.length,
        stage_titles: stages.map(s => s.title),
        pipeline_stage: 'agent_processing'
      }
    });

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex];

      console.log(`🔄 AGENT - Processing stage ${stageIndex + 1}/${stages.length}: ${stage.title} (trace_id: ${traceId})`);

      // Track individual stage processing start
      phClient.capture({
        distinctId: userId.subject,
        event: 'agent_individual_stage_started',
        properties: {
          trace_id: traceId,
          run_id: runId,
          course_id: args.courseId,
          stage_index: stageIndex,
          stage_title: stage.title,
          stage_purpose: stage.purpose,
          stage_topics: stage.include,
          pipeline_stage: 'agent_processing'
        }
      });
      const stagePrompt = `You are SphereAI, an advanced educational agent. Your mission is to produce a comprehensive, multi-slide learning module for the following stage of a course:
      Title: ${stage.title}
      Purpose: ${stage.purpose}
      Topics: ${stage.include.join(", ")}
      Outcome: ${stage.outcome}
      Discussion area: ${stage.discussion_prompt || ""}`;
      try {
        // Use streamText with tools for better debugging and control
        const streamResult = streamText({
          model: tracedModel('gemini-2.5-flash', {
            stage_index: stageIndex,
            stage_title: stage.title,
            stage_purpose: stage.purpose,
            stream_processing: true
          }),
// Allow multiple steps for tool usage and final generation
        system: `<SystemInstruction>
          <Agent>
            <Name>SphereAI</Name>
            <Purpose>
              You are an advanced educational agent designed to generate comprehensive, multi-slide learning modules for any student-requested topic.
            </Purpose>
            <language>
             try to keep the language simple and clear, avoiding jargon and complex terms. Use plain English and avoid technical jargon., most of the user are from global south and english is not their first languge, so use simple english that is easy to understand and avoid using idioms and colloquialisms.
            </language>
          </Agent>

          <Workflow>


            <Phase1 name="Information Gathering">
              <Note>Use your tools intentionally and do NOT call all tools at once—select tools based on topic needs.</Note>
              <Step number="1" tool="getSyllabusTools">
                Obtain a detailed syllabus for the target subject.
              </Step>
              <Step number="2" tool="webSearchTools">
                Perform 1-2 targeted web searches relevant to the topic; avoid exhaustive search.
              </Step>
              <Step number="3" tool="getCodeTools">
                Retrieve code examples if the topic involves programming.
              </Step>
              <Step number="4" tool="svgTool">
                Generate 1-2 SVG diagrams to visually represent key concepts or processes.
              </Step>
              <Step number="5" tool="flashcardsTools">
                Extract up to 3 core flashcards summarizing essential concepts.
              </Step>
              <Step number="6" tool="testTools">
                Create up to 5 assessment questions for self-evaluation.
              </Step>
              <Step number="7" tool="MermaidTool">
                Generate diagrams in Mermaid syntax for supported chart types or structures.
              </Step>
            </Phase1>


            <Phase2 name="Synthesis and Response">
              <Step number="8">
                Analyze all results gathered from the tools.
              </Step>
              <Step number="9">
                Synthesize a coherent, well-structured learning experience integrating all content types.
              </Step>
              <Step number="10">
                Generate a comprehensive, easy-to-understand text explanation for the module.
              </Step>
              <Step number="11">
                Aggregate all results into the required JSON structure.
              </Step>
            </Phase2>


          </Workflow>

          <MandatoryJSONStructure>
            <![CDATA[
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
                    {"question": "What is X?", "answer": "X is..."}
                  ],
                  "testQuestions": [
                    {"question": "What is the correct answer?", "options": ["A", "B", "C", "D"], "answer": "A"}
                  ],
                  "type": "markdown"
                }
              ]
            }
            ]]>
            <FieldNotes>
              <SVG>Populate from svgTool results; include only for main content slides, not code, test, or flashcard slides.</SVG>
              <Flashcards>Place each flashcard in a separate slide with type "flashcard".</Flashcards>
              <Tests>Place each test question in a dedicated slide with type "test".</Tests>
              <Code>Include example code from getCodeTools only if the topic is programming-related.</Code>
              <Mermaid>Use MermaidTool for supported diagrams and charts; embed as appropriate.</Mermaid>
            </FieldNotes>
          </MandatoryJSONStructure>

          <ContentGuidelines>
            <LearningExperience>
              Always ensure a clear structure with explanatory text, followed by complete JSON output.
            </LearningExperience>
            <Separation>
              Test questions and flashcards must be presented on their own dedicated slides, not mixed with main content.
            </Separation>
            <SVGUsage>
              Create diagrams that add conceptual clarity; avoid including SVG on slides for assessments, flashcards, tables, or code.
            </SVGUsage>
            <UserExperience>
              Organize content for maximum clarity and ease-of-use; ensure logical flow and scaffolding for learning, always keep the language simple don't use any technical jargon or complex terminology , most of the users are from the global south like africa and asia , where english is not their first language , so use simple and clear language.
            </UserExperience>
            <Finalization>
              <Rule>
                After gathering all tool outputs, always:
                <List>
                  <Item>Summarize your key findings and insights in a comprehensive explanatory text.</Item>
                  <Item>Present the generated learning module JSON, fully populated with all tool results and structures.</Item>
                </List>
                <Failure>If you do not return both text summary and JSON, you have FAILED your mission.</Failure>
              </Rule>
            </Finalization>
          </ContentGuidelines>
        </SystemInstruction>
`,
          prompt: stagePrompt,
          tools: {
            getSyllabusTools,
            webSearchTools,
            knowledgeSearchTools,
            getCodeTools,
            testTools,
            flashcardsTools,
            svgTool,
            MermaidTool
          },
          onChunk({ chunk }) {
            console.log(`🔄 STREAM CHUNK - Stage ${stageIndex + 1}: ${chunk.type} (trace_id: ${traceId})`);

            // Generic chunk inspection to avoid TypeScript errors
            const chunkAny = chunk as any;

            switch (chunk.type) {
              case 'text-delta':
                if (chunkAny.textDelta) {
                  console.log(`  Text delta: "${chunkAny.textDelta}"`);
                }
                break;

              case 'tool-call':
                console.log(`🔧 TOOL CALL DETECTED - Stage ${stageIndex + 1}`);
                if (chunkAny.toolName) {
                  console.log(`  Tool name: ${chunkAny.toolName}`);

                  // Track streaming tool call
                  phClient.capture({
                    distinctId: userId.subject,
                    event: 'agent_stream_tool_call',
                    properties: {
                      trace_id: traceId,
                      run_id: runId,
                      course_id: args.courseId,
                      stage_index: stageIndex,
                      stage_title: stage.title,
                      tool_name: chunkAny.toolName,
                      tool_input: chunkAny.input || chunkAny.args,
                      pipeline_stage: 'agent_processing'
                    }
                  });
                }
                if (chunkAny.input) {
                  console.log(`  Input:`, chunkAny.input);
                }
                if (chunkAny.args) {
                  console.log(`  Args:`, chunkAny.args);
                }
                break;

              case 'tool-result':
                console.log(`✅ TOOL RESULT DETECTED - Stage ${stageIndex + 1}`);
                if (chunkAny.toolName) {
                  console.log(`  Tool name: ${chunkAny.toolName}`);
                }
                const result = chunkAny.result || chunkAny.toolResult || chunkAny.data;
                if (result) {
                  console.log(`  Result type: ${typeof result}`);

                  // Track streaming tool result
                  phClient.capture({
                    distinctId: userId.subject,
                    event: 'agent_stream_tool_result',
                    properties: {
                      trace_id: traceId,
                      run_id: runId,
                      course_id: args.courseId,
                      stage_index: stageIndex,
                      stage_title: stage.title,
                      tool_name: chunkAny.toolName,
                      result_type: typeof result,
                      result_size: typeof result === 'string' ? result.length : JSON.stringify(result).length,
                      pipeline_stage: 'agent_processing'
                    }
                  });

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
                console.log(`🔍 OTHER CHUNK - Stage ${stageIndex + 1}: ${chunk.type}`);
                console.log(`Available properties:`, Object.keys(chunkAny));
                break;
            }
          },
          onFinish({ text, toolCalls, toolResults, steps, finishReason, usage }) {
            console.log(`🏁 STREAM FINISHED - Stage ${stageIndex + 1}/${stages.length}: ${stage.title} (trace_id: ${traceId})`);
            console.log(`Final text length: ${text?.length || 0}`);
            console.log(`Tool calls: ${toolCalls?.length || 0}`);
            console.log(`Tool results: ${toolResults?.length || 0}`);
            console.log(`Steps: ${steps?.length || 0}`);
            console.log(`Finish reason: ${finishReason}`);
            console.log(`Usage:`, usage);

            // Track stream completion
            phClient.capture({
              distinctId: userId.subject,
              event: 'agent_stream_finished',
              properties: {
                trace_id: traceId,
                run_id: runId,
                course_id: args.courseId,
                stage_index: stageIndex,
                stage_title: stage.title,
                final_text_length: text?.length || 0,
                tool_calls_count: toolCalls?.length || 0,
                tool_results_count: toolResults?.length || 0,
                steps_count: steps?.length || 0,
                finish_reason: finishReason,
                usage: usage,
                pipeline_stage: 'agent_processing'
              }
            });

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
            console.error(`❌ STREAM ERROR - Stage ${stageIndex + 1}: ${stage.title} (trace_id: ${traceId}):`, error);

            // Track stream error
            phClient.capture({
              distinctId: userId.subject,
              event: 'agent_stream_error',
              properties: {
                trace_id: traceId,
                run_id: runId,
                course_id: args.courseId,
                stage_index: stageIndex,
                stage_title: stage.title,
                error_message: error instanceof Error ? error.message : 'Unknown error',
                pipeline_stage: 'agent_processing'
              }
            });
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
              model: tracedModel('gemini-2.5-flash', {
                stage_index: stageIndex,
                stage_title: stage.title,
                synthesis_phase: true
              }),


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

        console.log(`🔄 AGENT - Generating structured output for stage ${stageIndex + 1}: ${stage.title} (trace_id: ${traceId})`);

        // Track structured generation start
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_structured_generation_started',
          properties: {
            trace_id: traceId,
            run_id: runId,
            course_id: args.courseId,
            stage_index: stageIndex,
            stage_title: stage.title,
            content_length: textToProcess?.length || 0,
            pipeline_stage: 'agent_processing'
          }
        });

        const result = await generateObject({
          model: tracedModel('gemini-2.5-flash', {
            stage_index: stageIndex,
            stage_title: stage.title,
            structured_generation: true
          }),
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

        // Track structured generation completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_structured_generation_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            course_id: args.courseId,
            stage_index: stageIndex,
            stage_title: stage.title,
            generated_slides_count: result.object.slides?.length || 0,
            output_size: JSON.stringify(result.object).length,
            pipeline_stage: 'agent_processing'
          }
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

        // Track individual stage completion
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_individual_stage_completed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            course_id: args.courseId,
            stage_index: stageIndex,
            stage_title: stage.title,
            stage_id: stageId,
            slides_count: parsed.data.slides.length,
            pipeline_stage: 'agent_processing'
          }
        });

        console.log(`✅ AGENT - Completed stage ${stageIndex + 1}/${stages.length}: ${stage.title} (stage_id: ${stageId}, trace_id: ${traceId})`);
      } catch (error) {
        console.error(`❌ AGENT - Stage ${stageIndex + 1} processing error (trace_id: ${traceId}):`, error);

        // Track individual stage error
        phClient.capture({
          distinctId: userId.subject,
          event: 'agent_individual_stage_failed',
          properties: {
            trace_id: traceId,
            run_id: runId,
            course_id: args.courseId,
            stage_index: stageIndex,
            stage_title: stage.title,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            pipeline_stage: 'agent_processing'
          }
        });
      }
    }

    // Track agent processing completion
    phClient.capture({
      distinctId: userId.subject,
      event: 'agent_processing_completed',
      properties: {
        trace_id: traceId,
        run_id: runId,
        course_id: args.courseId,
        total_stages: stages.length,
        completed_stages: stageIds.length,
        stage_ids: stageIds,
        pipeline_stage: 'agent_processing'
      }
    });

    console.log(`🟢 AGENT PIPELINE - Completed successfully. Created ${stageIds.length}/${stages.length} stages (trace_id: ${traceId})`);

    // Flush PostHog data
    try {
      await phClient.shutdown();
      console.log(`✅ AGENT - PostHog data flushed successfully for trace_id: ${traceId}`);
    } catch (flushError) {
      console.error(`❌ AGENT - Failed to flush PostHog data for trace_id: ${traceId}:`, flushError);
    }

    return stageIds;
  },
});
