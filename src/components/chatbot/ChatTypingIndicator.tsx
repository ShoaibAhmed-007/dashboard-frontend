"use client";

import { LuBotMessageSquare } from "react-icons/lu";

export default function ChatTypingIndicator({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 px-2 py-1">
      <div className="w-8 h-8 rounded-full bg-dashboard-gradient flex items-center justify-center text-white shrink-0">
        <LuBotMessageSquare className="w-4 h-4" />
      </div>
      {label ? (
        <div className="flex items-center gap-2">
          <div className="h-16 w-16 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <span className="text-xs text-gray-400">{label}</span>
        </div>
      ) : (
        <span className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}
