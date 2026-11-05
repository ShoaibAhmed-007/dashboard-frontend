"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuPlus, LuPencil, LuTrash2 } from "react-icons/lu";
import { useChatConversations } from "@/hooks/useChatConversations";

export default function ChatbotPanelContent() {
  const router = useRouter();
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    createConversation,
    deleteConversation,
    renameConversation,
  } = useChatConversations();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleNewChat = async () => {
    if (isCreating) return;
    setIsCreating(true);
    try {
      await createConversation();
      router.push("/chat");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelect = (id: string) => {
    setActiveConversationId(id);
    router.push("/chat");
  };

  const startRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle);
  };

  const commitRename = (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) void renameConversation(id, trimmed);
    setRenamingId(null);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-2 py-3 text-[14px]">
      <div className="flex items-center justify-between px-2 pb-2">
        <p className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">Dashboard AI</p>
        <button
          type="button"
          onClick={handleNewChat}
          disabled={isCreating}
          title="New chat"
          className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LuPlus className={`w-4 h-4 ${isCreating ? "animate-pulse" : ""}`} />
        </button>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto no-scrollbar">
        {conversations.length === 0 && (
          <p className="px-2 py-2 text-xs text-gray-400 italic">No conversations yet</p>
        )}

        {conversations.map((c) => {
          const isActive = c.id === activeConversationId;
          const isRenaming = renamingId === c.id;
          return (
            <div
              key={c.id}
              className={`group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename(c.id);
                    }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 bg-transparent border-b border-brand-400 focus:outline-none text-[13px]"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => handleSelect(c.id)}
                  className="flex-1 min-w-0 text-left truncate"
                >
                  {c.title}
                </button>
              )}

              {!isRenaming && (
                <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startRename(c.id, c.title)}
                    title="Rename"
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    <LuPencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteConversation(c.id)}
                    title="Delete"
                    className="text-gray-400 hover:text-red-500"
                  >
                    <LuTrash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
