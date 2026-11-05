"use client";

import { useState } from "react";
import { LuCheckCheck, LuChevronLeft } from "react-icons/lu";
import { useNotifications } from "@/context/NotificationContext";
import { useTaskStore } from "@/stores/task.store";
import type { Notification } from "@/types/notification";

function initials(str: string): string {
  return str
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const TONES = ["warm", "rose", "dark", "violet"] as const;
type Tone = (typeof TONES)[number];

function toneForId(id: string): Tone {
  const code = id.charCodeAt(id.length - 1) || 0;
  return TONES[code % TONES.length];
}

function Avatar({ id, name, size = "h-8 w-8" }: { id: string; name: string; size?: string }) {
  const tone = toneForId(id);
  const tones: Record<Tone, string> = {
    warm: "bg-gradient-to-br from-orange-200 via-orange-600 to-gray-950 text-white",
    rose: "bg-gradient-to-br from-pink-300 via-purple-700 to-gray-950 text-white",
    dark: "bg-gradient-to-br from-gray-300 via-gray-600 to-gray-950 text-white",
    violet: "bg-gradient-to-br from-violet-300 via-violet-600 to-gray-950 text-white",
  };
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-[10px] font-semibold shadow-sm ${tones[tone]}`}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

function ReplyCard({ n, actorDisplayName, onClick }: { n: Notification; actorDisplayName: string; onClick: () => void }) {
  const actorId = n.actorId ?? "?";
  const taskLabel = n.taskName ?? n.title;
  const originalComment = n.commentName ?? n.message ?? "";
  const isReply = n.replyCommentId && n.replyCommentId !== n.commentId;

  return (
    <section
      className="relative cursor-pointer rounded-lg border border-gray-200 bg-white py-4 pl-5 pr-5 shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition-colors hover:bg-gray-50"
      onClick={onClick}
    >
      <span className="absolute left-0 top-0 h-full w-1 rounded-l-lg bg-[#6941ff]" />

      <div className="flex h-9 items-center gap-1.5 text-[12px] text-gray-500">
        <span>In</span>
        <span className="font-medium text-gray-800 truncate max-w-[200px]">{taskLabel}</span>
        {!n.isRead && (
          <span className="ml-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
        )}
      </div>

      <div className="mt-2 space-y-4">
        <div className="flex gap-3">
          <Avatar id={actorId} name={actorDisplayName} size="h-8 w-8" />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-[13px] leading-5">
              <span className="font-semibold text-gray-950">{actorDisplayName}</span>
              <span className="ml-1.5 text-gray-400">{formatTime(n.createdAt)}</span>
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-gray-800">{originalComment}</p>
          </div>
        </div>

        {isReply && (
          <div className="ml-11 flex gap-3">
            <Avatar id={actorId} name={actorDisplayName} size="h-7 w-7" />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-5">
                <span className="font-semibold text-gray-950">{actorDisplayName}</span>
                <span className="ml-1.5 text-gray-400">replied</span>
              </p>
              <p className="mt-0.5 text-[13px] leading-5 text-gray-800">{n.message}</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center bg-gray-910 dark:bg-[#090909]">
      <LuCheckCheck className="mb-3 h-13 w-13 text-gray-200" />
      <p className="text-[18px] font-bold text-brand-400">No {label} replies</p>
    </div>
  );
}

export default function RepliesPage() {
  const { replies, markRead, memberName } = useNotifications();
  const openTaskDetail = useTaskStore((s) => s.openTaskDetail);
  const openTaskDetailAtComment = useTaskStore((s) => s.openTaskDetailAtComment);
  const [activeTab, setActiveTab] = useState<"unread" | "read">("unread");

  const unread = replies.filter((n) => !n.isRead);
  const read = replies.filter((n) => n.isRead);
  const list = activeTab === "unread" ? unread : read;

  const handleClick = (n: Notification) => {
    if (!n.isRead) markRead(n.id);
    if (n.taskId && n.commentId) {
      void openTaskDetailAtComment(n.taskId, n.commentId);
    } else if (n.taskId) {
      void openTaskDetail(n.taskId);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b  border-gray-200 dark:border-gray-800">
        <div className="flex h-12 items-center justify-between px-6">
          <div className="flex items-center gap-3 pl-2">
            {/* <LuChevronLeft className="h-5 w-5 text-gray-500 dark:text-gray-400" /> */}
            <h1 className="text-[14px] font-semibold text-gray-950 -mt-3 dark:text-white">Replies</h1>
          </div>
          {/* <LuCheckCheck className="h-5 w-5 text-gray-500 dark:text-gray-400" /> */}
        </div>

        <div className="flex items-end gap-0.5 px-6">
          <button
            className={`text-[12px] font-normal border-b-2 transition-colors group ${activeTab === "unread" ? "border-gray-950 dark:border-gray-100 text-gray-950 dark:text-white" : "border-transparent text-gray-500 dark:text-gray-400"}`}
            onClick={() => setActiveTab("unread")}
          >
            <span className={`flex items-center gap-1 px-2  py-1 rounded-lg transition-colors ${activeTab === "unread" ? "" : "group-hover:bg-gray-100 dark:group-hover:bg-gray-800 group-hover:text-gray-700 dark:group-hover:text-gray-200"}`}>
              Unread{" "}
              {unread.length > 0 && (
                <span className={activeTab === "unread" ? "font-medium text-gray-500 dark:text-gray-400" : ""}>{unread.length}</span>
              )}
            </span>
          </button>
          <button
            className={`text-[12px] font-normal border-b-2 transition-colors group ${activeTab === "read" ? "border-gray-950 dark:border-gray-100 text-gray-950 dark:text-white" : "border-transparent text-gray-500 dark:text-gray-400"}`}
            onClick={() => setActiveTab("read")}
          >
            <span className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors ${activeTab === "read" ? "" : "group-hover:bg-gray-100 dark:group-hover:bg-gray-800 group-hover:text-gray-700 dark:group-hover:text-gray-200"}`}>
              Read <span>{read.length}</span>
            </span>
          </button>
        </div>
      </header>

      <main className="h-[calc(100%-96px)] overflow-auto bg-white dark:bg-gray-900">
        {list.length === 0 ? (
          <EmptyState label={activeTab} />
        ) : (
          <div className="space-y-4">
            {list.map((n) => (
              <ReplyCard
                key={n.id}
                n={n}
                actorDisplayName={memberName(n.actorId ?? "")}
                onClick={() => handleClick(n)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
