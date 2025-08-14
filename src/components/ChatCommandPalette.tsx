"use client";
import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useConvexAuth } from "convex/react";

interface ChatCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = "chat" | "learn";

// Type guards to safely check item types
const isChat = (
  item: any,
): item is {
  _id: Id<"chats">;
  title: string;
  model: string;
  updatedAt: number;
  pinned: boolean;
} => {
  return (
    "title" in item &&
    "model" in item &&
    "updatedAt" in item &&
    "pinned" in item
  );
};

const isCourse = (
  item: any,
): item is {
    _id: Id<"Course">;
    prompt: string;
    stages: any[];
    createdAt: number;
} => {
  return "prompt" in item && "stages" in item && "createdAt" in item;
};

const ChatCommandPalette = ({ isOpen, onClose }: ChatCommandPaletteProps) => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentMode, setCurrentMode] = useState<Mode>("chat");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Better Auth session
  const { isAuthenticated, isLoading } = useConvexAuth();

  // Fetch chats and courses from Convex only when authenticated
  const canQuery = isOpen && !isLoading && !!isAuthenticated;
  const chats = useQuery(api.chats.listChats, canQuery ? {} : "skip");
  const courses = useQuery(api.course.listCourse, canQuery ? {} : "skip");

  const searchChatResults = useQuery(
    api.chats.searchChats,
    canQuery && searchQuery.trim() && currentMode === "chat"
      ? { query: searchQuery }
      : "skip",
  );

  const searchCourseResults = useQuery(
    // Assuming this is the correct server function; leaving as-is
    api.course.searchChats,
    canQuery && searchQuery.trim() && currentMode === "learn"
      ? { query: searchQuery }
      : "skip",
  );

  // Focus management
  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Get filtered items based on current mode
  const getFilteredItems = () => {
    if (currentMode === "chat") {
      const items = searchQuery.trim()
        ? searchChatResults || []
        : (chats || []).slice(0, 10);
      return items;
    } else {
      const items = searchQuery.trim()
        ? searchCourseResults || []
        : (courses || []).slice(0, 10);
      return items;
    }
  };

  const filteredItems = getFilteredItems();

  const handleArrowNavigation = (direction: "up" | "down") => {
    if (!filteredItems.length) return;
    if (direction === "down") {
      setSelectedIndex((prevIndex) => (prevIndex + 1) % filteredItems.length);
    } else {
      setSelectedIndex(
        (prevIndex) =>
          (prevIndex - 1 + filteredItems.length) % filteredItems.length,
      );
    }
  };

  const handleItemSelection = (itemId?: string) => {
    if (!filteredItems.length) return;

    const selectedItem = itemId
      ? filteredItems.find((item) => item._id === itemId)
      : filteredItems[selectedIndex];

    if (selectedItem) {
      if (currentMode === "chat") {
        router.push(`/learning/chat/${selectedItem._id}`);
      } else {
        router.push(`/learning/learn/${selectedItem._id}`);
      }
      onClose();
    }
  };

  const formatDate = (timestamp: number) => {
    try {
      return formatDistanceToNow(timestamp, { addSuffix: true });
    } catch {
      return "Unknown time";
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    return text.length > maxLength
      ? text.substring(0, maxLength) + "..."
      : text;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") handleArrowNavigation("down");
    if (e.key === "ArrowUp") handleArrowNavigation("up");
    if (e.key === "Enter") handleItemSelection();
    if (e.key === "Escape") onClose();
    if (e.key === "Tab") {
      e.preventDefault();
      setCurrentMode(currentMode === "chat" ? "learn" : "chat");
      setSelectedIndex(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Outer glossy frame */}
      <div className="relative w-[760px] max-w-[92vw]">
        <div className="rounded-3xl p-[1px] bg-gradient-to-b from-white/15 via-white/5 to-white/15 shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
          {/* Card base */}
          <div className="relative rounded-3xl bg-[#0D0D0D] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-1px_0_rgba(255,255,255,0.04)] overflow-hidden">
            {/* Big search input */}
            <div className="px-6 pt-6">
              <label htmlFor="palette-search" className="sr-only">
                Search
              </label>
              <input
                id="palette-search"
                className="w-full bg-transparent text-[28px] leading-[2.75rem] font-light text-white placeholder:text-white/60 outline-none"
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Search for ${currentMode === "chat" ? "chats" : "courses"}`}
                ref={searchInputRef}
                type="text"
                value={searchQuery}
              />
            </div>

            {/* Subtle divider under input */}
            <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Results area */}
            <div className="max-h-[420px] overflow-y-auto px-2 py-2">
              {filteredItems.length === 0 ? (
                <div className="flex h-[340px] items-center justify-center">
                  <p className="text-sm text-white/45">
                    {searchQuery.trim()
                      ? `No ${currentMode === "chat" ? "chats" : "courses"} found`
                      : `No ${currentMode === "chat" ? "chats" : "courses"} available`}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {filteredItems.map((item, index) => {
                    const isActive = index === selectedIndex;
                    const title =
                      currentMode === "chat" && isChat(item)
                        ? truncateText(item.title, 60)
                        : currentMode === "learn" && isCourse(item)
                        ? truncateText(item.prompt, 60)
                        : "Unknown item";

                    const meta =
                      currentMode === "chat" && isChat(item)
                        ? `${formatDate(item.updatedAt)}`
                        : currentMode === "learn" && isCourse(item)
                        ? `${item.stages?.length || 0} stages • ${formatDate(item.createdAt)}`
                        : "Unknown details";

                    return (
                      <li
                        key={item._id}
                        className={[
                          "cursor-pointer rounded-xl px-4 sm:px-5 py-4 my-1 transition-colors",
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-white/80 hover:bg-white/5",
                        ].join(" ")}
                        onClick={() => handleItemSelection(item._id)}
                        onMouseEnter={() => setSelectedIndex(index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">

                            <div className="min-w-0">
                              <p className="truncate text-[16px]">{title}</p>
                              <p className="mt-0.5 text-xs text-white/55">{meta}</p>
                            </div>
                          </div>

                          {currentMode === "chat" && isChat(item) && item.pinned && (
                            <span className="text-sm text-yellow-400">📌</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Bottom bar with mode selector */}
            <div className="relative mt-2 border-t   border-white/10">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                <div className="flex text-md items-center gap-6">
                  <button
                    aria-selected={currentMode === "chat"}
                    className={[
                      "text-2xl transition-colors",
                      currentMode === "chat"
                        ? "text-white font-bold"
                        : "text-white/60 hover:text-white/80",
                    ].join(" ")}
                    onClick={() => {
                      setCurrentMode("chat");
                      setSelectedIndex(0);
                      searchInputRef.current?.focus();
                    }}
                  >
                    Chat
                  </button>
                  <button
                    aria-selected={currentMode === "learn"}
                    className={[
                      " transition-colors text-2xl",
                      currentMode === "learn"
                        ? "text-white font-bold"
                        : "text-white/60 hover:text-white/80",
                    ].join(" ")}
                    onClick={() => {
                      setCurrentMode("learn");
                      setSelectedIndex(0);
                      searchInputRef.current?.focus();
                    }}
                  >
                    Learn
                  </button>
                </div>

                {/* Hints kept minimal for cleanliness */}
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-white/35">
                  <span className="rounded bg-white/10 px-1.5 py-0.5">Tab</span>
                  <span>switch</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 ml-2">↑↓</span>
                  <span>navigate</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 ml-2">Enter</span>
                  <span>select</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 ml-2">Esc</span>
                  <span>close</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Soft outer glow to enhance depth */}
        <div className="pointer-events-none absolute inset-0 -z-10 rounded-[28px] blur-2xl bg-black/40" />
      </div>
    </div>
  );
};

export default ChatCommandPalette;
