"use client";

import { LuBotMessageSquare, LuCopy, LuCheck, LuRotateCcw } from "react-icons/lu";
import { getInitials } from "@/lib/getInitials";
import type { ChatMessage } from "@/hooks/useChatConversations";
import ChatMarkdown from "@/components/chatbot/ChatMarkdown";
import ChatAttachmentList from "@/components/chatbot/ChatAttachmentList";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ChatMessageBubble({
  message,
  userName,
  onRetry,
  onRegenerateImage,
  isRegeneratingImage,
}: {
  message: ChatMessage;
  userName: string;
  onRetry?: () => void;
  onRegenerateImage?: () => void;
  isRegeneratingImage?: boolean;
}) {
  const isUser = message.role === "user";
  const { copy, copied } = useCopyToClipboard();

  return (
    <div className="flex items-start gap-3 px-2 py-1">
      {isUser ? (
        <div className="w-8 h-8 rounded-full bg-indigo-500 dark:bg-gray-000 dark:text-black flex items-center justify-center text-white text-xs font-normal shrink-0 mt-0.5">
          {getInitials(userName)}
        </div>
      ) : (
        <div className="w-8 h-8 rounded-full bg-dashboard-gradient flex items-center justify-center text-white shrink-0 mt-0.5">
          <LuBotMessageSquare className="w-4 h-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-white">
            {isUser ? userName : "Dashboard AI"}
          </span>
          <span className="text-xs text-gray-400">{formatTime(message.createdAt)}</span>
        </div>
        {isUser ? (
          <div className="mt-0.5">
            <ChatAttachmentList attachments={message.attachments} />
            {message.content && (
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-0.5">
            <ChatAttachmentList
              attachments={message.attachments}
              onRegenerate={onRegenerateImage}
              regenerating={isRegeneratingImage}
            />
            <ChatMarkdown content={message.content} />
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => copy(message.content)}
                title="Copy message"
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {copied ? (
                  <>
                    <LuCheck className="w-3 h-3" /> Copied
                  </>
                ) : (
                  <>
                    <LuCopy className="w-3 h-3" /> Copy
                  </>
                )}
              </button>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500 transition-colors"
                >
                  <LuRotateCcw className="w-3 h-3" /> Try again
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
