"use client";

import { useEffect, useRef, useState } from "react";
import { clientFetch } from "@/lib/client-api";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: string;
};

type ChatPanelProps = {
  projectId: string;
  messages: Message[];
  onNewMessage: (message: Message) => void;
  disabled?: boolean;
};

export function ChatPanel({ projectId, messages, onNewMessage, disabled }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending || disabled) return;

    const userMessage = input.trim();
    setInput("");
    setSending(true);

    onNewMessage({
      id: `temp-${Date.now()}`,
      role: "user",
      content: userMessage,
      createdAt: new Date().toISOString(),
    });

    try {
      const res = await clientFetch(`/api/projects/${projectId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage }),
      });
      const data = await res.json();
      if (res.ok) {
        onNewMessage(data.message);
        window.dispatchEvent(new CustomEvent("app-updated"));
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 p-4 min-h-0">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-8 px-4 leading-relaxed">
            描述你想要的修改，智能体将帮你优化应用…
          </p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-zinc-800 text-zinc-200 rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? "等待生成完成..." : "描述修改需求..."}
            disabled={disabled || sending}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-500 transition-colors duration-200 hover:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/80 focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled || sending || !input.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-200 focus-ring shrink-0"
          >
            {sending ? "发送中" : "发送"}
          </button>
        </div>
      </form>
    </div>
  );
}
