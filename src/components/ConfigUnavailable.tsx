type ConfigUnavailableProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  tone?: "light" | "dark";
};

export function ConfigUnavailable({
  title = "配置服务不可用",
  message,
  onRetry,
  tone = "light",
}: ConfigUnavailableProps) {
  const titleClass = tone === "dark" ? "text-zinc-100" : "text-zinc-800";
  const messageClass = tone === "dark" ? "text-zinc-400" : "text-zinc-500";
  const hintClass = tone === "dark" ? "text-zinc-500" : "text-zinc-400";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center text-xl">
        !
      </div>
      <div className="max-w-md space-y-2">
        <h2 className={`text-lg font-semibold ${titleClass}`}>{title}</h2>
        <p className={`text-sm leading-relaxed ${messageClass}`}>{message}</p>
        <p className={`text-xs ${hintClass}`}>
          请确认 Python 后端已启动（默认端口 8000），然后重试。
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
        >
          重试
        </button>
      )}
    </div>
  );
}
