"use client";

import { useState } from "react";
import {
  LuCheck,
  LuFilter,
  LuMessageSquare,
  LuSearch,
  LuUserRoundCheck,
  LuUserRoundCog,
} from "react-icons/lu";
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
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

function Avatar({
  id,
  name,
  size = "h-7 w-7",
}: {
  id: string;
  name: string;
  size?: string;
}) {
  const tone = toneForId(id);
  const tones: Record<Tone, string> = {
    warm: "bg-gradient-to-br from-orange-200 via-orange-500 to-gray-950 text-white",
    rose: "bg-gradient-to-br from-pink-300 via-purple-600 to-gray-950 text-white",
    dark: "bg-gradient-to-br from-gray-300 via-gray-600 to-gray-950 text-white",
    violet: "bg-gradient-to-br from-violet-300 via-violet-600 to-gray-950 text-white",
  };
  return (
    <span
      className={`${size} ${tones[tone]} flex shrink-0 items-center justify-center rounded-full text-[9px] font-semibold shadow-sm`}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

function CommentCard({ n, actorDisplayName, onClick }: { n: Notification; actorDisplayName: string; onClick: () => void }) {
  const actorId = n.actorId ?? "?";
  const title = n.taskName ?? n.title;
  const body = n.commentName ?? n.message ?? "";

  return (
    <section
      className="mx-6 mb-10 max-w-[1032px] cursor-pointer"
      onClick={onClick}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[#fb6f45] text-white">
            <LuMessageSquare className="h-3.5 w-3.5" />
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full border border-white bg-gray-700" />
          </span>
          <h2 className="truncate text-sm font-semibold text-gray-950">{title}</h2>
          {!n.isRead && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className="flex items-center gap-1.5 whitespace-nowrap text-[12px] text-gray-500">
            <span>Comment by</span>
            <Avatar id={actorId} name={actorDisplayName} size="h-4 w-4" />
            <span className="font-medium text-gray-800">{actorDisplayName}</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-[0_1px_2px_rgba(16,24,40,0.13)] hover:border-gray-300 transition-colors">
        <div className="flex gap-3">
          <Avatar id={actorId} name={actorDisplayName} size="h-8 w-8" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-gray-700">
              <span className="font-semibold text-gray-950">{actorDisplayName}</span>
              <span className="ml-1 text-gray-400">{formatDate(n.createdAt)}</span>
            </p>
            <p className="mt-0.5 text-[13px] text-gray-800">{body}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <LuMessageSquare className="mb-3 h-13 w-13 text-gray-200" />
      <p className="text-[18px] font-bold text-brand-400">No assigned comments</p>
    </div>
  );
}

export default function AssignedCommentsPage() {
  const { assignedComments, markRead, memberName } = useNotifications();
  const openTaskDetail = useTaskStore((s) => s.openTaskDetail);
  const openTaskDetailAtComment = useTaskStore((s) => s.openTaskDetailAtComment);
  const [activeTab, setActiveTab] = useState<"assigned" | "delegated">("assigned");

  const list = activeTab === "assigned" ? assignedComments : [];

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
      <header className="  border-gray-100 dark:border-gray-800">
        <div className="px-6 pt-2">
          <h1 className="text-[14px] font-semibold text-gray-950 dark:text-white pl-2">Assigned Comments</h1>

          <div className="mt-6 flex items-end justify-between">
            <div className="flex items-center gap-0.5">
              <button
                className={`border-b-2 text-[12px] font-normal transition-colors group ${
                  activeTab === "assigned"
                    ? "border-gray-950 dark:border-gray-100 text-gray-950 dark:text-white"
                    : "border-transparent text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("assigned")}
              >
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${activeTab === "assigned" ? "" : "group-hover:bg-gray-100 dark:group-hover:bg-gray-800 group-hover:text-gray-700 dark:group-hover:text-gray-200"}`}>
                  <LuUserRoundCheck className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                  Assigned to me
                  {assignedComments.length > 0 && (
                    <span className="ml-1 rounded-full bg-brand-100 dark:bg-brand-900/40 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:text-brand-400">
                      {assignedComments.length}
                    </span>
                  )}
                </span>
              </button>
              <button
                className={`border-b-2 text-[12px] font-normal transition-colors group ${
                  activeTab === "delegated"
                    ? "border-gray-950 dark:border-gray-100 text-gray-950 dark:text-white"
                    : "border-transparent text-gray-500 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab("delegated")}
              >
                <span className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors ${activeTab === "delegated" ? "" : "group-hover:bg-gray-100 dark:group-hover:bg-gray-800 group-hover:text-gray-700 dark:group-hover:text-gray-200"}`}>
                  <LuUserRoundCog className="h-4 w-4 dark:text-gray-400" />
                  Delegated by me
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex h-12 items-center justify-between bg-gray-910 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-6">
          <div className="flex items-center gap-2">
            <button className="inline-flex font-semibold h-8 items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-1 text-[12px] text-gray-600 dark:text-gray-300 shadow-[0_1px_2px_rgba(16,24,40,0.14)] transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
              <LuFilter className="h-3.5 w-3.5" />
              Filter
            </button>
            <button className="inline-flex font-semibold h-8 items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-2 py-0.5 text-[12px] text-gray-600 dark:text-gray-300 shadow-[0_1px_2px_rgba(16,24,40,0.14)] transition-colors hover:bg-gray-100 dark:hover:bg-gray-800">
              <LuCheck className="h-3.5 w-3.5" />
              Resolved
            </button>
          </div>

          <button className="inline-flex items-center gap-1.5 text-[13px] text-gray-400 dark:text-gray-500">
            <LuSearch className="h-4 w-4" />
            Search
          </button>
        </div>
      </header>

      <main className="h-[calc(100%-138px)] overflow-auto bg-gray-910 dark:bg-gray-900 pt-9">
        {list.length === 0 ? (
          <EmptyState />
        ) : (
          list.map((n) => (
            <CommentCard
              key={n.id}
              n={n}
              actorDisplayName={memberName(n.actorId ?? "")}
              onClick={() => handleClick(n)}
            />
          ))
        )}
      </main>
    </div>
  );
}
