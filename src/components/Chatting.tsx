"use client";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
} from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import type { Id } from "../../convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";
import ChatCommandPalette from "../components/ChatCommandPalette";
import { api } from "../../convex/_generated/api";
import { useConvexAuth } from "convex/react";
import { Response } from '@/components/ai-elements/response';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';

// Helper function to parse message content and extract reasoning
const parseMessageContent = (content: string | string[]) => {
  if (Array.isArray(content)) {
    content = content.join('');
  }

  try {
    const parsed = JSON.parse(content);
    if (parsed.type === 'ai-response') {
      return {
        isStructured: true,
        content: parsed.content,
        reasoning: parsed.reasoning,
        model: parsed.model,
      };
    }
  } catch (e) {
    // Not structured JSON, treat as plain text
  }

  return {
    isStructured: false,
    content: content,
    reasoning: null,
  };
};

const messageSchema = z.object({
  message: z.string().trim().min(1, { message: "Message cannot be empty" }),
});

type MessageFormValues = z.infer<typeof messageSchema>;

const Chatting = () => {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { chat: chatID } = useParams<{ chat: string }>();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showChatPalette, setShowChatPalette] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const convexChatId = chatID as Id<"chats">;

  // Convex hooks - only query if we have a valid chatId
  const chat = useQuery(
    api.chats.getChat,
    chatID ? { chatId: convexChatId } : "skip",
  );
  const messages = useQuery(
    api.message.getMessages,
    chatID ? { chatId: convexChatId } : "skip",
  );

  // Mutations
  const addMessage = useMutation(api.message.addMessage);
  const streamChatCompletion = useAction(api.ai.streamChatCompletion);

  // Form for new messages
  const form = useForm({
    defaultValues: {
      message: "",
    } as MessageFormValues,
    onSubmit: async ({ value }) => {
      if (!chat) return;
      try {
        // Add user message
        const userMessageId = await addMessage({
          chatId: convexChatId,
          content: value.message,
          role: "user",
        });

        // Clear form
        form.reset();

        // Stream AI response
        const assistantMessageId = await streamChatCompletion({
          chatId: convexChatId,
          messages: value.message,
          parentMessageId: userMessageId,
        });

        // Track streaming for reasoning UI
        setStreamingMessageId(assistantMessageId);

        // Clear streaming state after a delay (you might want to handle this better)
        setTimeout(() => setStreamingMessageId(null), 1000);
      } catch (error) {
        console.error("Error sending message:", error);
        setStreamingMessageId(null);
      }
    },
    validators: {
      onSubmit: messageSchema,
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Update document title when chat data is loaded
  useEffect(() => {
    if (chat && chat.title) {
      document.title = `${chat.title}`;
    } else if (chatID) {
      document.title = `Learning Session ${chatID}`;
    }
  }, [chat, chatID]);

  // Keyboard shortcuts for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowChatPalette(true);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle missing chatID
  if (!chatID) {
    return (
      <div className="relative flex h-[100svh] w-[100svw] items-center justify-center">
        {/* Background */}
        <div className="absolute inset-0 z-0 bg-black" />
        {/* Noise overlay */}
        <div
          className="absolute inset-0 z-10 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <div className="relative z-20 text-center">
          <h1 className="mb-4 font-bold text-2xl text-white">Invalid Chat</h1>
          <p className="mb-4 text-white/70">No chat ID provided</p>
          <button
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
            onClick={() => router.push("/learning")}
          >
            Go to Learning
          </button>
        </div>
      </div>
    );
  }

  // Handle loading state
  if (chat === undefined || messages === undefined) {
    return (
      <div className="relative flex h-[100svh] w-[100svw] items-center justify-center">
        {/* Background */}
        <div className="absolute inset-0 z-0 bg-black" />
        {/* Noise overlay */}
        <div
          className="absolute inset-0 z-10 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <div className="relative z-20 text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-white/60 border-b-2" />
          <p className="text-white/80">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // Handle chat not found
  if (chat === null) {
    return (
      <div className="relative flex h-[100svh] w-[100svw] items-center justify-center">
        {/* Background */}
        <div className="absolute inset-0 z-0 bg-black" />
        {/* Noise overlay */}
        <div
          className="absolute inset-0 z-10 opacity-20"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <div className="relative z-20 text-center">
          <h1 className="mb-4 font-bold text-2xl text-white">Chat Not Found</h1>
          <p className="mb-4 text-white/70">Try again after some time</p>
          <button
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-white transition-colors hover:bg-white/20"
            onClick={() => router.push("/learning")}
          >
            Go to Learning
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-[100svh] w-[100svw] flex-col">
      {/* Background */}
      <div className="absolute inset-0 z-0 bg-black" />
      {/* Noise overlay */}
      <div
        className="absolute inset-0 z-10 opacity-20"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />
      {/* Grid lines */}
      <div className="pointer-events-none absolute inset-0 z-15">
        {/* Vertical lines */}
        <div className="absolute top-0 left-[10%] h-full w-px bg-white/20" />
        <div className="absolute top-0 left-[90%] h-full w-px bg-white/20" />
        {/* Corner circles */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-[9%] left-[20%] h-2 w-2 transform rounded-full bg-white/60" />
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-[9%] left-[80%] h-2 w-2 transform rounded-full bg-white/60" />
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-[90%] left-[20%] h-2 w-2 transform rounded-full bg-white/60" />
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-[90%] left-[80%] h-2 w-2 transform rounded-full bg-white/60" />
      </div>

      {/* Header */}
      <div className="relative z-20 flex-shrink-0 border-white/10 border-b">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                className="text-white/60 transition-colors hover:text-white"
                onClick={() => router.push("/learning")}
              >
                <ArrowLeftIcon size={20} />
              </button>
              <div>
                <h1 className="font-medium text-white text-xl">{chat.title}</h1>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages - Scrollable area */}
      <div className="relative z-20 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="space-y-6">
            {messages && messages.length > 0 ? (
              messages.map((message, _index) => {
                const parsedContent = parseMessageContent(message.content);

                return (
                  <div
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    key={message._id}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-4 py-3 ${
                        message.role === "user"
                          ? "border border-white/20 bg-white/10 text-white"
                          : "max-w-[100%] text-white/90"
                      }`}
                    >
                      {/* Show reasoning only for assistant messages that have reasoning */}
                      {message.role === "assistant" && parsedContent.reasoning && (
                        <Reasoning
                          className="w-full mb-4"
                          isStreaming={streamingMessageId === message._id}
                        >
                          <ReasoningTrigger title="AI Reasoning" />
                          <ReasoningContent className="whitespace-pre-wrap text-sm leading-relaxed text-white/70 bg-white/5 rounded-md p-3 border border-white/10">
                            {parsedContent.reasoning}
                          </ReasoningContent>

                        </Reasoning>
                      )}

                      {/* Main message content */}
                      <div className="whitespace-pre-wrap text-sm leading-relaxed">
                        <Response>
                          {parsedContent.content}
                        </Response>
                      </div>



                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-white/40">
                <p>No messages yet. Start the conversation!</p>
              </div>
            )}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input area - Fixed at bottom */}
      <div className="relative z-20 flex-shrink-0 border-white/10 border-t">
        <div className="mx-auto max-w-4xl px-6 py-4">
          <form
            className="w-full"
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
          >
            <div className="flex-1">
              <form.Field name="message">
                {({ state, handleBlur, handleChange }) => (
                  <div className="relative">
                    <textarea
                      className="w-full resize-none rounded-full border border-white/10 bg-white/5 px-4 py-4 pr-14 text-sm text-white placeholder:text-white/40 backdrop-blur-sm focus:border-white/20 focus:outline-none focus:ring-2 focus:ring-white/20"
                      onBlur={handleBlur}
                      onChange={(e) => handleChange(e.target.value)}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height = `${target.scrollHeight}px`;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void form.handleSubmit();
                        }
                      }}
                      placeholder="Continue the conversation..."
                      rows={1}
                      style={{
                        minHeight: "48px",
                        maxHeight: "140px",
                        height: "auto",
                      }}
                      value={state.value}
                    />
                    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                      {([canSubmit, isSubmitting]) => (
                        <button
                          className="absolute bottom-4 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={!canSubmit || isSubmitting}
                          type="submit"
                          aria-label="Send message"
                        >
                          {isSubmitting ? (
                            <ArrowClockwiseIcon className="animate-spin" size={18} />
                          ) : (
                            <ArrowUpIcon size={18} />
                          )}
                        </button>
                      )}
                    </form.Subscribe>
                    {state.meta.errors.length > 0 && (
                      <div className="mt-2 text-xs text-red-400">
                        {String(state.meta.errors[0])}
                      </div>
                    )}
                  </div>
                )}
              </form.Field>
            </div>

          </form>
        </div>
      </div>

      {/* Chat Command Palette */}
      <ChatCommandPalette
        isOpen={showChatPalette}
        onClose={() => setShowChatPalette(false)}
      />
    </div>
  );
};

export default Chatting;
