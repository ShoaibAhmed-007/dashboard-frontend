"use client";
import React, { useState } from "react";
import { Task } from "@/types/task";
import { useTasks } from "@/context/TaskContext";

export default function TaskChecklistSection({ task }: { task: Task }) {
  const { addChecklist, addChecklistItem, toggleChecklistItem, deleteChecklistItem } = useTasks();
  const [open, setOpen] = useState(true);
  const [newListName, setNewListName] = useState("");
  const [addingList, setAddingList] = useState(false);
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [newItemText, setNewItemText] = useState("");

  function submitList() {
    const n = newListName.trim();
    if (n) addChecklist(task.id, n);
    setNewListName(""); setAddingList(false);
  }

  function submitItem(checklistId: string) {
    const t = newItemText.trim();
    if (t) addChecklistItem(task.id, checklistId, t);
    setNewItemText(""); setAddingItem(null);
  }

  const totalItems = task.checklists.reduce((a, cl) => a + cl.items.length, 0);
  const doneItems = task.checklists.reduce((a, cl) => a + cl.items.filter((i) => i.completed).length, 0);

  return (
    <div className="border-b border-gray-100 dark:border-gray-800 py-4">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between text-sm font-normal text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Checklist
          {totalItems > 0 && (
            <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {doneItems}/{totalItems}
            </span>
          )}
        </span>
        <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {task.checklists.map((cl) => {
            const clDone = cl.items.filter((i) => i.completed).length;
            return (
              <div key={cl.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-normal uppercase tracking-wide text-gray-500 dark:text-gray-400">{cl.name}</span>
                  <span className="text-xs text-gray-400">{clDone}/{cl.items.length}</span>
                </div>
                {cl.items.length > 0 && (
                  <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${cl.items.length ? (clDone / cl.items.length) * 100 : 0}%` }} />
                  </div>
                )}
                <div className="space-y-1">
                  {cl.items.map((item) => (
                    <div key={item.id} className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <button
                        onClick={() => toggleChecklistItem(task.id, cl.id, item.id)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          item.completed ? "border-brand-500 bg-brand-500 text-white" : "border-gray-300 dark:border-gray-600 hover:border-brand-500"
                        }`}
                      >
                        {item.completed && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </button>
                      <span className={`flex-1 text-sm ${item.completed ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>{item.text}</span>
                      <button onClick={() => deleteChecklistItem(task.id, cl.id, item.id)} className="hidden h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-red-500 group-hover:flex">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  {addingItem === cl.id ? (
                    <div className="flex items-center gap-2 px-2">
                      <div className="h-4 w-4 shrink-0 rounded border border-gray-300 dark:border-gray-600" />
                      <input autoFocus value={newItemText} onChange={(e) => setNewItemText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") submitItem(cl.id); if (e.key === "Escape") { setAddingItem(null); setNewItemText(""); } }}
                        onBlur={() => submitItem(cl.id)} placeholder="Item…"
                        className="flex-1 rounded bg-transparent py-1 text-sm text-gray-700 placeholder-gray-400 outline-none dark:text-gray-300"
                      />
                    </div>
                  ) : (
                    <button onClick={() => { setAddingItem(cl.id); setNewItemText(""); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1 text-xs text-gray-400 hover:text-brand-500 hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Add item
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {addingList ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={newListName} onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitList(); if (e.key === "Escape") { setAddingList(false); setNewListName(""); } }}
                onBlur={submitList} placeholder="Checklist name…"
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
          ) : (
            <button onClick={() => setAddingList(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-400 hover:bg-gray-50 hover:text-brand-500 dark:hover:bg-gray-800/60">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add checklist
            </button>
          )}
        </div>
      )}
    </div>
  );
}
