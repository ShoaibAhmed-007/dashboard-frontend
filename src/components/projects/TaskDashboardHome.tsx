"use client";

import dynamic from "next/dynamic";
import type { MemberOption } from "@/components/projects/AssigneePicker";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GrFlagFill } from "react-icons/gr";
import { toast } from "sonner";
import {
  LuCalendarDays,
  LuChevronDown,
  LuFileText,
  LuList,
  LuPaperclip,
  LuPlus,
  LuSettings,
  LuUser,
  LuX,
} from "react-icons/lu";
import { useQuery } from "@tanstack/react-query";
import { dashboardService, DashboardList, DashboardPriority } from "@/services/dashboard.service";
import { activityService, ActivityItem } from "@/services/activity.service";
import { WorkspaceMember } from "@/services/workspace.service";
import { parseApiError } from "@/lib/api";
import { queryKeys } from "@/queries/keys";
import ProjectDocsBox from "@/components/docs/ProjectDocsBox";
import DatePicker from "./DatePicker";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface TaskDashboardHomeProps {
  projectId: string;
  projectName: string;
  members: MemberOption[];
  onCreateList?: () => void;
}

const PRIORITY_OPTIONS: { value: DashboardPriority; label: string; color: string }[] = [
  { value: "URGENT", label: "Urgent", color: "#ef4444" },
  { value: "HIGH", label: "High", color: "#f97316" },
  { value: "NORMAL", label: "Normal", color: "#3b82f6" },
  { value: "LOW", label: "Low", color: "#94a3b8" },
  { value: "NONE", label: "None", color: "#d1d5db" },
];

function getPriorityColor(priority: DashboardPriority | null): string {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.color ?? "#d1d5db";
}

function getPriorityLabel(priority: DashboardPriority | null): string {
  return PRIORITY_OPTIONS.find((p) => p.value === priority)?.label ?? "None";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "🗜️";
  return "📎";
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Priority Dropdown ────────────────────────────────────────────────────────
function PriorityPicker({
  value,
  onChange,
}: {
  value: DashboardPriority | null;
  onChange: (p: DashboardPriority | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  const color = getPriorityColor(value);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
        title={getPriorityLabel(value)}
      >
        <GrFlagFill className="h-3 w-3" style={{ color }} />
        {value && value !== "NONE" && (
          <span className="text-xs" style={{ color }}>
            {getPriorityLabel(value)}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value === "NONE" ? null : opt.value);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <GrFlagFill className="h-3 w-3" style={{ color: opt.color }} />
                {opt.label}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── Owner Picker ─────────────────────────────────────────────────────────────
function OwnerPicker({
  owner,
  members,
  onChange,
}: {
  owner: { id: string; fullName: string; avatarUrl: string | null; avatarColor: string } | null;
  members: MemberOption[];
  onChange: (memberId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!dropRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex items-center justify-center rounded p-0.5 hover:bg-gray-100 dark:hover:bg-gray-800"
        title={owner?.fullName ?? "Assign owner"}
      >
        {owner ? (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium text-white"
            style={{ backgroundColor: owner.avatarColor }}
          >
            {getInitials(owner.fullName)}
          </span>
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700">
            <LuUser className="h-3.5 w-3.5 text-gray-400" />
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={dropRef}
            style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
            className="w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            {owner && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <LuX className="h-3 w-3" />
                Remove owner
              </button>
            )}
            {members.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-medium text-brand-600">
                  {getInitials(m.fullName)}
                </span>
                <span className="truncate">{m.fullName}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TaskDashboardHome({
  projectId,
  projectName,
  members,
  onCreateList,
}: TaskDashboardHomeProps) {
  const dashboardQueryKey = queryKeys.projectDashboard(projectId);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [lists, setLists] = useState<DashboardList[]>([]);

  const dashboardQuery = useQuery({
    queryKey: dashboardQueryKey,
    queryFn: () => dashboardService.get(projectId),
    enabled: !!projectId,
    staleTime: 5 * 60_000,
  });
  const data = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;

  useEffect(() => {
    if (dashboardQuery.data) setLists(dashboardQuery.data.lists);
  }, [dashboardQuery.data]);

  useEffect(() => {
    if (!projectId) return;
    setActivity([]);
    activityService
      .getProjectActivity(projectId, { limit: 10 })
      .then((act) => {
        setActivity(act.items);
        setNextCursor(act.nextCursor);
      })
      .catch(() => {
        toast.error("Failed to load project overview");
      });
  }, [projectId]);

  const loadMoreActivity = useCallback(async () => {
    if (!nextCursor || activityLoading) return;
    setActivityLoading(true);
    try {
      const page = await activityService.getProjectActivity(projectId, { limit: 10, cursor: nextCursor });
      setActivity((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      toast.error("Failed to load more activity");
    } finally {
      setActivityLoading(false);
    }
  }, [activityLoading, nextCursor, projectId]);

  const updateList = useCallback(
    async (
      listId: string,
      patch: Partial<Pick<DashboardList, "startDate" | "endDate" | "priority" | "owner" | "ownerUserId">>,
      apiPayload: Parameters<typeof dashboardService.updateList>[2]
    ) => {
      // optimistic update
      setLists((prev) =>
        prev.map((l) => (l.id === listId ? { ...l, ...patch } : l))
      );
      try {
        const updated = await dashboardService.updateList(projectId, listId, apiPayload);
        setLists((prev) =>
          prev.map((l) =>
            l.id === listId
              ? {
                  ...l,
                  startDate: updated.startDate,
                  endDate: updated.endDate,
                  priority: updated.priority,
                  owner: updated.owner,
                  ownerUserId: updated.ownerUserId,
                }
              : l
          )
        );
      } catch (err) {
        toast.error(parseApiError(err).message);
        // revert
        if (data) setLists(data.lists);
      }
    },
    [data, projectId]
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const statusSummary = data?.statusSummary ?? [];
  const attachments = data?.attachments ?? [];

  const chartSeries = statusSummary.filter((s) => s.count > 0).map((s) => s.count);
  const chartLabels = statusSummary.filter((s) => s.count > 0).map((s) => s.name);
  const chartColors = statusSummary.filter((s) => s.count > 0).map((s) => s.color);
  const totalTasks = statusSummary.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="space-y-4 pb-8">
      {/* ── Row 1: Recent Activity + Docs ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recent Activity */}
        <div className="flex h-72 flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901">
          <h3 className="mb-3 shrink-0 text-base font-normal text-gray-800 dark:text-white">Recent</h3>
          {activity.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                <LuList className="h-5 w-5" />
              </span>
              <p className="text-sm text-gray-400">No activity yet in this project.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: item.actor.avatarColor }}
                  >
                    {getInitials(item.actor.fullName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-700 dark:text-gray-200">
                      {item.category === "description" ? `${item.actor.fullName} updated description` : item.displayText}
                    </p>
                    <p className="text-xs text-gray-400">{timeAgo(item.createdAt)}</p>
                  </div>
                </div>
              ))}
              {nextCursor && (
                <button
                  type="button"
                  onClick={() => void loadMoreActivity()}
                  disabled={activityLoading}
                  className="mt-2 w-full text-center text-xs text-brand-500 hover:text-brand-600 disabled:opacity-50"
                >
                  {activityLoading ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Docs — project-scoped list */}
        <ProjectDocsBox projectId={projectId} />
      </div>

      {/* ── Row 2: Lists table ── */}
      <div className="flex h-80 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-901">
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-base font-normal text-gray-800 dark:text-white">Lists</h3>
          <button
            type="button"
            onClick={onCreateList}
            className="text-sm font-normal text-brand-500 hover:text-brand-600 dark:text-gray-200 dark:hover:text-gray-000"
          >
            Create List
          </button>
        </div>
        <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/40">
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-2 font-normal">Name</th>
                <th className="px-4 py-2 font-normal">Color</th>
                <th className="px-4 py-2 font-normal">Progress</th>
                <th className="px-4 py-2 font-normal">Start / End</th>
                <th className="px-4 py-2 font-normal">Priority</th>
                <th className="px-4 py-2 font-normal">Owner</th>
                <th className="px-4 py-2 font-normal">
                  <LuSettings className="h-3.5 w-3.5" />
                </th>
              </tr>
            </thead>
            <tbody>
              {lists.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                    No lists yet in {projectName}.
                  </td>
                </tr>
              ) : (
                lists.map((list) => {
                  return (
                    <tr key={list.id} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <LuList className="h-3.5 w-3.5 text-gray-400" />
                          <span className="font-normal text-gray-700 dark:text-gray-200">{list.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-sm">-</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="relative h-1.5 w-32 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            {list.taskCount > 0 && (
                              <>
                                {/* green = completed */}
                                <div
                                  className="absolute left-0 top-0 h-full bg-green-500"
                                  style={{ width: `${(list.completedCount / list.taskCount) * 100}%` }}
                                />
                                {/* black = open/in-progress, starts after green */}
                                <div
                                  className="absolute top-0 h-full bg-gray-900 dark:bg-gray-200"
                                  style={{
                                    left: `${(list.completedCount / list.taskCount) * 100}%`,
                                    width: `${(list.openCount / list.taskCount) * 100}%`,
                                  }}
                                />
                              </>
                            )}
                          </div>
                          <span className="text-xs font-normal text-gray-400">
                            {list.completedCount}/{list.taskCount}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DatePicker
                          startDate={list.startDate}
                          dueDate={list.endDate}
                          onChange={({ startDate, dueDate }) => {
                            const toDateOnly = (v: string | null) => v ? v.slice(0, 10) : null;
                            void updateList(
                              list.id,
                              { startDate: toDateOnly(startDate), endDate: toDateOnly(dueDate) },
                              { startDate: toDateOnly(startDate), endDate: toDateOnly(dueDate) }
                            );
                          }}
                          iconSize="sm"
                          showLabel
                        />
                      </td>
                      <td className="px-4 py-3">
                        <PriorityPicker
                          value={list.priority}
                          onChange={(p) => {
                            void updateList(list.id, { priority: p }, { priority: p });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <OwnerPicker
                          owner={list.owner}
                          members={members}
                          onChange={(memberId) => {
                            void updateList(list.id, {}, { ownerId: memberId });
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-300 dark:text-gray-600"> </td>
                    </tr>
                  );
                })
              )}
              <tr className="border-t border-gray-100 dark:border-gray-800">
                <td colSpan={7} className="px-4 py-2">
                  <button
                    type="button"
                    onClick={onCreateList}
                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <LuPlus className="h-4 w-4" />
                    New List
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Row 3: Attachments + Workload by Status ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Attachments */}
        <div className="flex h-72 flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901">
          <h3 className="mb-3 shrink-0 text-base font-normal text-gray-800 dark:text-white">Resources</h3>
          {attachments.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                <LuPaperclip className="h-5 w-5" />
              </span>
              <p className="text-sm text-gray-400">No attachments in this project yet.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5 dark:border-gray-800">
                  <span className="text-xl">{getFileIcon(att.mimeType)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-normal text-gray-800 dark:text-gray-100">
                      {att.fileName}
                    </p>
                    <p className="truncate text-xs text-gray-400">
                      {att.taskKey} · {att.listName} · {formatFileSize(att.fileSize)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium text-white"
                      style={{ backgroundColor: att.uploadedBy.avatarColor }}
                      title={att.uploadedBy.fullName}
                    >
                      {getInitials(att.uploadedBy.fullName)}
                    </span>
                    <span className="text-xs text-gray-400">{timeAgo(att.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Workload by Status */}
        <div className="flex h-72 flex-col rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-901">
          <h3 className="mb-3 shrink-0 text-base font-normal text-gray-800 dark:text-white">Workload by Status</h3>
          {totalTasks === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-gray-800">
                <LuList className="h-5 w-5" />
              </span>
              <p className="text-sm text-gray-400">No tasks yet in this project.</p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">
              <ReactApexChart
                type="pie"
                width={260}
                series={chartSeries}
                options={{
                  labels: chartLabels,
                  colors: chartColors,
                  legend: { show: false },
                  dataLabels: { enabled: false },
                  stroke: { width: 2 },
                  tooltip: {
                    y: {
                      formatter: (val: number) => `${val} task${val === 1 ? "" : "s"}`,
                    },
                  },
                }}
              />
              <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                {statusSummary.map((s) => (
                  <div key={s.statusId} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-300">
                      {s.name.toUpperCase()} {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
