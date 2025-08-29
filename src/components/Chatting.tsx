"use client";
import {
  ArrowClockwiseIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  BookOpenIcon,
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
import { Response } from "@/components/ai-elements/response";

// -------- Parsing helper (unchanged) ----------
const parseMessageContent = (content: string | string[]) => {
  if (Array.isArray(content)) {
    content = content.join("");
  }

  if (!content || content.trim() === "") {
    return {
      isStructured: false,
      content: "",
      reasoning: null,
    };
  }

  if (typeof content === "string" && content.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(content);
      if (parsed && parsed.type === "ai-response" && parsed.content) {
        return {
          isStructured: true,
          content: parsed.content,
          reasoning: parsed.reasoning,
          model: parsed.model,
        };
      }
    } catch {
      // swallow & treat as plain text
    }
  }

  return {
    isStructured: false,
    content: content,
    reasoning: null,
  };
};

// -------- Validation ----------
const messageSchema = z.object({
  message: z.string().trim().min(1, { message: "Message cannot be empty" }),
});

type MessageFormValues = z.infer<typeof messageSchema>;

const Chatting = () => {
  const { isAuthenticated, isLoading } = useConvexAuth(); // potentially used later for gating
  const { chat: chatID } = useParams<{ chat: string }>();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showChatPalette, setShowChatPalette] = useState(false);
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);

  const convexChatId = chatID as Id<"chats">;

  // Data
  const chat = useQuery(
    api.chats.getChat,
    chatID ? { chatId: convexChatId } : "skip",
  );
  const messages = useQuery(
    api.message.getMessages,
    chatID ? { chatId: convexChatId } : "skip",
  );
  const activeStreamingSession = useQuery(
    api.message.getActiveStreamingSession,
    chatID ? { chatId: convexChatId } : "skip",
  );

  // Mutations
  const addMessage = useMutation(api.message.addMessage);
  const streamChatCompletion = useAction(api.ai.streamChatCompletion);

  // Form
  const form = useForm({
    defaultValues: { message: "" } as MessageFormValues,
    onSubmit: async ({ value }) => {
      if (!chat) return;
      try {
        const userMessageId = await addMessage({
          chatId: convexChatId,
          content: value.message,
          role: "user",
        });

        form.reset();
        if (textareaRef.current) {
          textareaRef.current.style.height = "48px";
          textareaRef.current.style.overflowY = "hidden";
        }

        await streamChatCompletion({
          chatId: convexChatId,
            // NOTE: original prop was 'messages' expecting a string for streaming
          messages: value.message,
          parentMessageId: userMessageId,
          useKnowledgeBase: useKnowledgeBase,
        });
      } catch (error) {
        console.error("Error sending message:", error);
      }
    },
    validators: {
      onSubmit: messageSchema,
    },
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Title
  useEffect(() => {
    if (chat && chat.title) {
      document.title = `${chat.title}`;
    } else if (chatID) {
      document.title = `Learning Session ${chatID}`;
    }
  }, [chat, chatID]);

  // Command palette shortcut
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

  // ----- States (loading / error / invalid) -----
  if (!chatID) {
    return (
      <div className="relative flex h-[100dvh] w-full items-center justify-center bg-black text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <div className="relative z-10 text-center px-6">
          <h1 className="mb-4 text-2xl font-bold">Invalid Chat</h1>
          <p className="mb-6 text-white/70 text-sm md:text-base">
            No chat ID provided
          </p>
          <button
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm md:text-base hover:bg-white/20 transition"
            onClick={() => router.push("/learning")}
          >
            Go to Learning
          </button>
        </div>
      </div>
    );
  }

  if (chat === undefined || messages === undefined) {
    return (
      <div className="relative flex h-[100dvh] w-full items-center justify-center bg-black text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <div className="relative z-10 text-center px-6">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-white/60" />
          <p className="text-white/80 text-sm md:text-base">
            Loading conversation...
          </p>
        </div>
      </div>
    );
  }

  if (chat === null) {
    return (
      <div className="relative flex h-[100dvh] w-full items-center justify-center bg-black text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            backgroundRepeat: "repeat",
            backgroundSize: "256px 256px",
          }}
        />
        <div className="relative z-10 text-center px-6">
          <h1 className="mb-4 text-2xl font-bold">Chat Not Found</h1>
          <p className="mb-6 text-white/70 text-sm md:text-base">
            Try again after some time
          </p>
            <button
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm md:text-base hover:bg-white/20 transition"
              onClick={() => router.push("/learning")}
            >
              Go to Learning
            </button>
        </div>
      </div>
    );
  }

  // ------------- MAIN LAYOUT -------------
  return (
    <div
      className="
        relative flex h-[100dvh] min-h-0 w-full flex-col
        bg-black text-white
        overscroll-none
      "
    >
      {/* Background noise */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Header */}
      <header
        className="
          relative z-10 flex-shrink-0
          px-3 py-3 md:px-6 md:py-6
          bg-gradient-to-b from-black/80 via-black/40 to-transparent
          backdrop-blur-sm
          safe-top
        "
      >
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              aria-label="Back to Learning"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full
                         text-white/70 hover:text-white active:scale-95 transition
                         bg-white/5 hover:bg-white/10"
              onClick={() => router.push("/learning")}
            >
              <ArrowLeftIcon size={20} />
            </button>
            <h1
              className="text-base font-medium line-clamp-1 max-w-[60vw] md:max-w-none md:text-lg text-white/90"
              title={chat.title}
            >
              {chat.title}
            </h1>
          </div>
          <div className="hidden md:flex items-center gap-2">
            {/* Future header actions */}
          </div>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <div
        className="
          relative z-0 flex-1 overflow-y-auto
          scroll-smooth
          px-3 md:px-6
          pb-40 md:pb-48
          pt-2 md:pt-4
        "
        id="chat-scroll-region"
        aria-live="polite"
      >
        <div className="mx-auto max-w-4xl space-y-4 md:space-y-6">
          {messages && messages.length > 0 ? (
            messages.map((message) => {
              const parsedContent = parseMessageContent(message.content);
              const isUser = message.role === "user";

              return (
                <div
                  key={message._id}
                  className={`flex w-full ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`
                      group rounded-2xl px-4 py-3 md:px-5 md:py-4
                      shadow-sm md:shadow
                      text-[13px] leading-relaxed md:text-sm
                      break-words whitespace-pre-wrap
                      ${isUser
                        ? "bg-white/10 border border-white/15 text-white max-w-[85%] md:max-w-[70%]"
                        : " text-white/90 max-w-[95%] md:max-w-[80%]"
                      }
                      backdrop-blur-sm
                    `}
                  >
                    <div className="prose prose-invert prose-sm max-w-none">
                      <Response>
                        {parsedContent.content || message.content}
                      </Response>
                    </div>

                    {activeStreamingSession?.messageId === message._id &&
                      activeStreamingSession?.isActive && (
                        <div className="flex items-center mt-3 text-white/50">
                          <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-white/40 mr-2" />
                          <span className="text-[11px] md:text-xs animate-pulse">
                            AI is thinking...
                          </span>
                        </div>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-white/40 text-sm md:text-base">
              <p>No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Top fade (mobile) */}
        <div className="pointer-events-none sticky -top-1 h-4 bg-gradient-to-b from-black to-transparent md:hidden" />
      </div>

      {/* Sticky Input Bar */}
      <div
        className="
          sticky bottom-0 z-20
          w-full

          px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]
          md:px-6 md:pt-4 md:pb-6
        "
        role="form"
        aria-label="Send a message"
      >
        <div className="mx-auto max-w-4xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void form.handleSubmit();
            }}
            className="relative"
          >
            <form.Field name="message">
              {({ state, handleBlur, handleChange }) => (
                <div
                  className="
                    relative flex items-end gap-2 md:gap-3
                    rounded-2xl border border-white/15
                    bg-black/50 backdrop-blur-md
                    focus-within:border-white/30
                    transition
                    px-3 py-2 md:px-5 md:py-3
                  "
                >
                  <div className="flex-1 min-w-0">
                    <textarea
                      ref={textareaRef}
                      className="
                        block w-full resize-none border-0 bg-transparent
                        text-sm md:text-base text-white placeholder:text-white/40
                        focus:outline-none focus:ring-0
                        leading-relaxed
                        max-h-40
                      "
                      aria-label="Message input"
                      disabled={!!activeStreamingSession?.isActive}
                      onBlur={handleBlur}
                      onChange={(e) => handleChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !activeStreamingSession?.isActive
                        ) {
                          e.preventDefault();
                          void form.handleSubmit();
                        }
                      }}
                      placeholder={
                        activeStreamingSession?.isActive
                          ? "AI is responding..."
                          : "Continue learning..."
                      }
                      value={state.value}
                      rows={1}
                      style={{ height: "auto", minHeight: "40px" }}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = "auto";
                        target.style.height =
                          Math.min(target.scrollHeight, 160) + "px";
                        // Optional: keep scroll pinned when typing on mobile
                        messagesEndRef.current?.scrollIntoView({
                          behavior: "instant",
                        } as any);
                      }}
                    />
                  </div>

                  <div className="flex items-center gap-1 md:gap-2 pb-1 md:pb-0">
                    <button
                      type="button"
                      aria-pressed={useKnowledgeBase}
                      aria-label={
                        useKnowledgeBase
                          ? "Disable knowledge base"
                          : "Enable knowledge base"
                      }
                      className={`
                        inline-flex h-10 w-10 items-center justify-center rounded-xl
                        transition-colors duration-200
                        ${
                          useKnowledgeBase
                            ? "bg-white/20 text-white"
                            : "text-white/50 hover:text-white hover:bg-white/10"
                        }
                      `}
                      onClick={() =>
                        !activeStreamingSession?.isActive &&
                        setUseKnowledgeBase((v) => !v)
                      }
                      disabled={!!activeStreamingSession?.isActive}
                      title={
                        useKnowledgeBase
                          ? "Knowledge base enabled"
                          : "Knowledge base disabled"
                      }
                    >
                      <BookOpenIcon size={20} />
                    </button>

                    <form.Subscribe
                      selector={(state) => [
                        state.canSubmit,
                        state.isSubmitting,
                      ]}
                    >
                      {([canSubmit, isSubmitting]) => {
                        const disabled =
                          !canSubmit ||
                          isSubmitting ||
                          activeStreamingSession?.isActive;
                        return (
                          <button
                            type="submit"
                            aria-label="Send message"
                            disabled={disabled}
                            className="
                              inline-flex h-10 w-10 items-center justify-center
                              rounded-full bg-white/90 text-black
                              hover:bg-white focus-visible:outline-none
                              disabled:opacity-50 disabled:cursor-not-allowed
                              transition
                              active:scale-95
                            "
                          >
                            {isSubmitting ||
                            activeStreamingSession?.isActive ? (
                              <ArrowClockwiseIcon
                                className="animate-spin"
                                size={18}
                              />
                            ) : (
                              <ArrowUpIcon size={18} />
                            )}
                          </button>
                        );
                      }}
                    </form.Subscribe>
                  </div>
                </div>
              )}
            </form.Field>

            <form.Subscribe selector={(s) => s.fieldMeta.message?.errors}>
              {(errors) =>
                errors && errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-400 px-2">
                    {String(errors[0])}
                  </div>
                )
              }
            </form.Subscribe>


          </form>
        </div>
      </div>

      {/* Command Palette */}
      <ChatCommandPalette
        isOpen={showChatPalette}
        onClose={() => setShowChatPalette(false)}
      />
    </div>
  );
};

export default Chatting;
