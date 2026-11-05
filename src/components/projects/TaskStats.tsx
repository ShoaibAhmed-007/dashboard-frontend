"use client";
import { useTaskStats } from "@/context/TaskContext";

interface Card { label: string; value: number; icon: string; color: string; bg: string }

export default function TaskStats() {
  const s = useTaskStats();

  const cards: Card[] = [
    { label: "Total Tasks", value: s.total, icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", color: "text-brand-600 dark:text-brand-400", bg: "bg-brand-50 dark:bg-brand-500/10" },
    { label: "To Do", value: s.todo, icon: "M12 6v6m0 0v6m0-6h6m-6 0H6", color: "text-gray-600 dark:text-gray-400", bg: "bg-gray-100 dark:bg-gray-800" },
    { label: "In Progress", value: s.inProgress, icon: "M13 10V3L4 14h7v7l9-11h-7z", color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-500/10" },
    { label: "Review", value: s.review, icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z", color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-500/10" },
    { label: "Done", value: s.done, icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-500/10" },
    { label: "Overdue", value: s.overdue, icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${c.bg}`}>
            <svg className={`h-5 w-5 ${c.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={c.icon} />
            </svg>
          </div>
          <p className={`text-2xl font-normal ${c.color}`}>{c.value}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
