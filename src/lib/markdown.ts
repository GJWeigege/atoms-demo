export type MarkdownTheme = "light" | "dark";

type ThemeClasses = {
  body: string;
  h1: string;
  h2: string;
  h3: string;
  h4: string;
  h5: string;
  h6: string;
  p: string;
  strong: string;
  em: string;
  code: string;
  pre: string;
  ul: string;
  ol: string;
  li: string;
  hr: string;
  blockquote: string;
  link: string;
  tableWrap: string;
  table: string;
  thead: string;
  th: string;
  td: string;
  tr: string;
  trEven: string;
};

const THEME: Record<MarkdownTheme, ThemeClasses> = {
  dark: {
    body: "text-zinc-200",
    h1: "text-xl font-bold text-white mt-2 mb-3 pb-2.5 border-b border-zinc-600/80 tracking-tight",
    h2: "text-base font-semibold text-zinc-50 mt-6 mb-2.5 pl-3 border-l-[3px] border-indigo-500",
    h3: "text-sm font-semibold text-zinc-100 mt-4 mb-2",
    h4: "text-sm font-medium text-indigo-200/90 mt-3.5 mb-1.5",
    h5: "text-xs font-semibold text-zinc-300 mt-3 mb-1 uppercase tracking-wide",
    h6: "text-xs font-medium text-zinc-400 mt-2 mb-1",
    p: "text-zinc-300 leading-relaxed mb-2.5 last:mb-0",
    strong: "font-semibold text-zinc-100",
    em: "italic text-zinc-300",
    code: "px-1.5 py-0.5 bg-zinc-950/80 border border-zinc-700/60 rounded text-indigo-300 text-[0.85em] font-mono",
    pre: "bg-zinc-950/90 border border-zinc-700/60 rounded-xl p-3.5 my-3 overflow-x-auto text-xs text-zinc-300 font-mono leading-relaxed",
    ul: "space-y-1.5 my-2.5 pl-1",
    ol: "space-y-1.5 my-2.5 pl-1 list-decimal list-inside",
    li: "text-zinc-300 leading-relaxed marker:text-indigo-400/80",
    hr: "my-5 border-0 h-px bg-gradient-to-r from-transparent via-zinc-500/60 to-transparent",
    blockquote:
      "my-3 pl-3 border-l-2 border-indigo-500/50 text-zinc-400 italic bg-zinc-900/40 rounded-r-lg py-2 pr-2",
    link: "text-indigo-400 hover:text-indigo-300 underline underline-offset-2",
    tableWrap: "my-3 overflow-x-auto rounded-lg border border-zinc-700/60",
    table: "w-full text-xs border-collapse",
    thead: "bg-zinc-800/90",
    th: "px-3 py-2 text-left font-semibold text-zinc-200 border-b border-zinc-600/80 whitespace-nowrap",
    td: "px-3 py-2 text-zinc-300 border-b border-zinc-800/80 align-top",
    tr: "bg-zinc-900/20",
    trEven: "bg-zinc-800/30",
  },
  light: {
    body: "text-zinc-700",
    h1: "text-xl font-bold text-zinc-900 mt-2 mb-3 pb-2.5 border-b border-zinc-200 tracking-tight",
    h2: "text-base font-semibold text-zinc-900 mt-6 mb-2.5 pl-3 border-l-[3px] border-indigo-500/70",
    h3: "text-sm font-semibold text-zinc-800 mt-4 mb-2",
    h4: "text-sm font-medium text-indigo-800/90 mt-3.5 mb-1.5",
    h5: "text-xs font-semibold text-zinc-600 mt-3 mb-1 uppercase tracking-wide",
    h6: "text-xs font-medium text-zinc-500 mt-2 mb-1",
    p: "text-zinc-600 leading-relaxed mb-2.5 last:mb-0",
    strong: "font-semibold text-zinc-900",
    em: "italic text-zinc-600",
    code: "px-1.5 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-indigo-700 text-[0.85em] font-mono",
    pre: "bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 my-3 overflow-x-auto text-xs text-zinc-300 font-mono leading-relaxed",
    ul: "space-y-1.5 my-2.5 pl-1",
    ol: "space-y-1.5 my-2.5 pl-1 list-decimal list-inside",
    li: "text-zinc-600 leading-relaxed marker:text-indigo-600/80",
    hr: "my-5 border-0 h-px bg-gradient-to-r from-transparent via-zinc-300 to-transparent",
    blockquote:
      "my-3 pl-3 border-l-2 border-indigo-400/60 text-zinc-500 italic bg-indigo-50/50 rounded-r-lg py-2 pr-2",
    link: "text-indigo-600 hover:text-indigo-700 underline underline-offset-2",
    tableWrap: "my-3 overflow-x-auto rounded-lg border border-zinc-200",
    table: "w-full text-xs border-collapse",
    thead: "bg-zinc-100",
    th: "px-3 py-2 text-left font-semibold text-zinc-800 border-b border-zinc-200 whitespace-nowrap",
    td: "px-3 py-2 text-zinc-600 border-b border-zinc-100 align-top",
    tr: "bg-white",
    trEven: "bg-zinc-50/80",
  },
};

const HEADING_CLASS: (keyof ThemeClasses)[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Allow only safe link protocols in rendered markdown. */
export function sanitizeLinkHref(href: string): string {
  const trimmed = href.trim().replace(/[\u0000-\u001f]/g, "");
  if (!trimmed) return "#";
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return "#";
  if (trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return escapeHtml(trimmed);
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return escapeHtml(trimmed);
  }
  const protocol = trimmed.split(":")[0]?.toLowerCase() ?? "";
  if (protocol === "http" || protocol === "https" || protocol === "mailto") {
    return escapeHtml(trimmed);
  }
  return "#";
}

function inlineFormat(text: string, t: ThemeClasses): string {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, `<strong class="${t.strong}">$1</strong>`);
  out = out.replace(/\*(.+?)\*/g, `<em class="${t.em}">$1</em>`);
  out = out.replace(/`([^`]+)`/g, `<code class="${t.code}">$1</code>`);
  out = out.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, label: string, href: string) =>
      `<a class="${t.link}" href="${sanitizeLinkHref(href)}" target="_blank" rel="noopener noreferrer">${label}</a>`,
  );
  return out;
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

function parseHeading(line: string): { level: number; text: string } | null {
  const m = line.trim().match(/^(#{1,6})\s+(.+)$/);
  if (!m) return null;
  return { level: m[1].length, text: m[2] };
}

function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|")) return false;
  return t.startsWith("|") || t.endsWith("|") || t.split("|").length >= 2;
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  if (!t.includes("|") || !t.includes("-")) return false;
  return /^\|?[\s\-:|]+\|[\s\-:|]+\|?$/.test(t);
}

function parseTableCells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function isUnorderedListItem(line: string): boolean {
  return /^[-*+]\s+/.test(line.trim());
}

function isOrderedListItem(line: string): boolean {
  return /^\d+\.\s+/.test(line.trim());
}

function isBlockquoteLine(line: string): boolean {
  return /^>\s?/.test(line.trim());
}

function isCodeFence(line: string): boolean {
  return /^```/.test(line.trim());
}

function isStructuralLine(line: string): boolean {
  return (
    isBlank(line) ||
    parseHeading(line) !== null ||
    isHr(line) ||
    isCodeFence(line) ||
    isBlockquoteLine(line) ||
    isUnorderedListItem(line) ||
    isOrderedListItem(line) ||
    isTableRow(line)
  );
}

function headingClass(level: number, t: ThemeClasses): string {
  const key = HEADING_CLASS[Math.min(level, 6) - 1];
  return t[key] as string;
}

function renderTable(lines: string[], start: number, t: ThemeClasses): { html: string; next: number } {
  const headerCells = parseTableCells(lines[start]);
  let i = start + 1;

  if (i < lines.length && isTableSeparator(lines[i])) {
    i++;
  }

  const bodyRows: string[][] = [];
  while (i < lines.length && isTableRow(lines[i]) && !isTableSeparator(lines[i])) {
    bodyRows.push(parseTableCells(lines[i]));
    i++;
  }

  const ths = headerCells
    .map((cell) => `<th class="${t.th}">${inlineFormat(cell, t)}</th>`)
    .join("");
  const trs = bodyRows
    .map((row, idx) => {
      const rowClass = idx % 2 === 1 ? t.trEven : t.tr;
      const tds = row
        .map((cell) => `<td class="${t.td}">${inlineFormat(cell, t)}</td>`)
        .join("");
      return `<tr class="${rowClass}">${tds}</tr>`;
    })
    .join("");

  const html = `<div class="${t.tableWrap}"><table class="${t.table}"><thead class="${t.thead}"><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
  return { html, next: i };
}

function renderList(
  lines: string[],
  start: number,
  ordered: boolean,
  t: ThemeClasses,
): { html: string; next: number } {
  const items: string[] = [];
  let i = start;
  const pattern = ordered ? /^\d+\.\s+/ : /^[-*+]\s+/;

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) break;
    if (!pattern.test(line.trim())) break;
    const content = line.trim().replace(pattern, "");
    items.push(`<li class="${t.li}${ordered ? "" : " list-disc ml-4"}">${inlineFormat(content, t)}</li>`);
    i++;
  }

  const tag = ordered ? "ol" : "ul";
  const listClass = ordered ? t.ol : t.ul;
  return { html: `<${tag} class="${listClass}">${items.join("")}</${tag}>`, next: i };
}

function renderBlockquote(lines: string[], start: number, t: ThemeClasses): { html: string; next: number } {
  const parts: string[] = [];
  let i = start;

  while (i < lines.length && isBlockquoteLine(lines[i])) {
    parts.push(lines[i].trim().replace(/^>\s?/, ""));
    i++;
  }

  return {
    html: `<blockquote class="${t.blockquote}">${inlineFormat(parts.join("\n"), t)}</blockquote>`,
    next: i,
  };
}

function renderCodeBlock(lines: string[], start: number, t: ThemeClasses): { html: string; next: number } {
  let i = start + 1;
  const codeLines: string[] = [];

  while (i < lines.length && !/^```/.test(lines[i].trim())) {
    codeLines.push(lines[i]);
    i++;
  }

  if (i < lines.length) i++;

  return {
    html: `<pre class="${t.pre}">${escapeHtml(codeLines.join("\n").trim())}</pre>`,
    next: i,
  };
}

function renderParagraph(lines: string[], start: number, t: ThemeClasses): { html: string; next: number } {
  const parts: string[] = [];
  let i = start;

  while (i < lines.length && !isBlank(lines[i]) && !isStructuralLine(lines[i])) {
    parts.push(lines[i]);
    i++;
  }

  if (parts.length === 0) {
    return { html: "", next: start + 1 };
  }

  const inner = parts.map((line) => inlineFormat(line, t)).join("<br />");
  return { html: `<p class="${t.p}">${inner}</p>`, next: i };
}

export function renderMarkdownToHtml(md: string, theme: MarkdownTheme = "dark"): string {
  if (!md.trim()) return "";

  const t = THEME[theme];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const htmlParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    if (isCodeFence(line)) {
      const block = renderCodeBlock(lines, i, t);
      htmlParts.push(block.html);
      i = block.next;
      continue;
    }

    const heading = parseHeading(line);
    if (heading) {
      const tag = `h${heading.level}`;
      htmlParts.push(
        `<${tag} class="${headingClass(heading.level, t)}">${inlineFormat(heading.text, t)}</${tag}>`,
      );
      i++;
      continue;
    }

    if (isHr(line)) {
      htmlParts.push(`<hr class="${t.hr}" />`);
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const block = renderTable(lines, i, t);
      htmlParts.push(block.html);
      i = block.next;
      continue;
    }

    if (isBlockquoteLine(line)) {
      const block = renderBlockquote(lines, i, t);
      htmlParts.push(block.html);
      i = block.next;
      continue;
    }

    if (isUnorderedListItem(line)) {
      const block = renderList(lines, i, false, t);
      htmlParts.push(block.html);
      i = block.next;
      continue;
    }

    if (isOrderedListItem(line)) {
      const block = renderList(lines, i, true, t);
      htmlParts.push(block.html);
      i = block.next;
      continue;
    }

    const block = renderParagraph(lines, i, t);
    if (block.html) htmlParts.push(block.html);
    i = block.next;
  }

  return `<div class="md-content ${t.body}">${htmlParts.join("")}</div>`;
}
