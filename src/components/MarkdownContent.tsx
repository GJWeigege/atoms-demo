"use client";

import { renderMarkdownToHtml, type MarkdownTheme } from "@/lib/markdown";

type MarkdownContentProps = {
  content: string;
  theme?: MarkdownTheme;
  className?: string;
};

export function MarkdownContent({ content, theme = "dark", className = "" }: MarkdownContentProps) {
  if (!content.trim()) return null;

  return (
    <div
      className={`md-render text-sm ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(content, theme) }}
    />
  );
}
