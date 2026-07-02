export type ThemeId = "modern" | "minimal" | "dark" | "playful";

export type ThemeOption = {
  id: ThemeId;
  label: string;
  description: string;
  emoji: string;
};

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "modern",
    label: "现代",
    description: "渐变与圆角，科技感",
    emoji: "✨",
  },
  {
    id: "minimal",
    label: "极简",
    description: "留白、细线、克制配色",
    emoji: "◻️",
  },
  {
    id: "dark",
    label: "深色",
    description: "暗色背景与高对比",
    emoji: "🌙",
  },
  {
    id: "playful",
    label: "活泼",
    description: "明亮色彩与趣味动效",
    emoji: "🎨",
  },
];
