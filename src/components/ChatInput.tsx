"use client";

import { useRef, useState } from "react";
import { AgentSelector } from "./AgentSelector";
import { ThemeSelector } from "./ThemeSelector";
import { BuildMenu } from "./BuildMenu";
import type { AgentConfig } from "@/lib/config/types";
import type { ThemeId } from "@/lib/themes";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onBuild?: () => void;
  onBuildFromTemplate?: () => void;
  onNewProject?: () => void;
  theme: ThemeId;
  onThemeChange: (theme: ThemeId) => void;
  sending?: boolean;
  building?: boolean;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
};

export function ChatInput({
  value,
  onChange,
  onSend,
  onBuild,
  onBuildFromTemplate,
  onNewProject,
  theme,
  onThemeChange,
  sending = false,
  building = false,
  placeholder = "描述你想创造什么… 输入 @ 选择团队成员",
  disabled = false,
  compact = false,
}: ChatInputProps) {
  const [showMention, setShowMention] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleChange(text: string) {
    onChange(text);

    const atMatch = text.match(/@(\w*)$/);
    if (atMatch) {
      setShowMention(true);
      setMentionFilter(atMatch[1]);
    } else {
      setShowMention(false);
      setMentionFilter("");
    }
  }

  function handleSelectAgent(agent: AgentConfig) {
    const atIndex = value.lastIndexOf("@");
    const prefix = atIndex >= 0 ? value.slice(0, atIndex) : "";
    onChange(`${prefix}@${agent.name} `);
    setShowMention(false);
    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && value.trim()) onSend();
    }
    if (e.key === "Escape") setShowMention(false);
  }

  return (
    <div className="relative">
      <AgentSelector
        open={showMention}
        filter={mentionFilter}
        onSelect={handleSelectAgent}
        onClose={() => setShowMention(false)}
      />

      <div
        className={`bg-white border border-zinc-200/80 shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-visible ${
          compact ? "rounded-2xl" : "rounded-3xl"
        }`}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={compact ? 1 : 3}
          className={`w-full bg-transparent text-zinc-800 placeholder:text-zinc-400 resize-none focus:outline-none leading-relaxed disabled:opacity-50 ${
            compact
              ? "px-4 py-3 text-sm"
              : "px-6 pt-5 pb-2 text-[15px]"
          }`}
        />
        <div className={`flex items-center justify-between ${compact ? "px-3 pb-3" : "px-4 pb-4"}`}>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => {
                onChange(value + (value.endsWith("@") ? "" : "@"));
                setShowMention(true);
                textareaRef.current?.focus();
              }}
              className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors text-lg"
              title="提及成员"
            >
              +
            </button>
            <ThemeSelector
              value={theme}
              onChange={onThemeChange}
              disabled={disabled || sending}
            />
            {onBuild && (
              <BuildMenu
                onBuild={onBuild}
                onBuildFromTemplate={onBuildFromTemplate}
                onNewProject={onNewProject}
                building={building}
                disabled={disabled}
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              title="语音输入（演示）"
              className="w-9 h-9 flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 10v1a7 7 0 01-14 0v-1M12 19v4M8 23h8"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={onSend}
              disabled={sending || disabled || !value.trim()}
              className="w-10 h-10 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              title="发送"
            >
              {sending ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
