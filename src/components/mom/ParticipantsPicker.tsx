"use client";

import { useMemo, useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import UserAvatar from "@/components/ui/UserAvatar";
import type { WorkspaceMember } from "@/services/workspace.service";

/**
 * Picks meeting participants from the workspace roster.
 *
 * Ids, not names: the API takes `participantIds` and rejects anyone who is not
 * a workspace member, so free text has nowhere to go. This replaces the
 * earlier name-chip input, which could only ever have produced values the
 * server would refuse.
 */
export default function ParticipantsPicker({
  members,
  value,
  onChange,
}: {
  members: WorkspaceMember[];
  /** Selected user ids. */
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const byId = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const selected = value
    .map((id) => byId.get(id))
    .filter((member): member is WorkspaceMember => Boolean(member));

  const candidates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const chosen = new Set(value);
    return members
      .filter((member) => !chosen.has(member.id))
      .filter(
        (member) =>
          !needle ||
          member.fullName.toLowerCase().includes(needle) ||
          member.email.toLowerCase().includes(needle)
      );
  }, [members, value, search]);

  const add = (id: string) => {
    onChange([...value, id]);
    setSearch("");
  };

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={() => setOpen(true)}
        className="flex min-h-[46px] w-full cursor-text flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 transition-colors focus-within:border-brand-500 dark:border-gray-700 dark:bg-gray-900"
      >
        {selected.map((member) => (
          <span
            key={member.id}
            className="flex items-center gap-1.5 rounded-lg bg-gray-100 py-1 pl-1 pr-1.5 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <UserAvatar
              name={member.fullName}
              avatarUrl={member.avatarUrl}
              color={member.avatarColor}
              size={20}
            />
            {member.fullName}
            <button
              type="button"
              aria-label={`Remove ${member.fullName}`}
              onClick={(event) => {
                event.stopPropagation();
                onChange(value.filter((id) => id !== member.id));
              }}
              className="rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
            >
              <LuX className="h-3 w-3" />
            </button>
          </span>
        ))}

        <input
          type="text"
          value={search}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setSearch(event.target.value);
            setOpen(true);
          }}
          /* Delayed so a click on an option lands before the list unmounts. */
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={selected.length === 0 ? "Search people to add" : ""}
          aria-label="Search people to add"
          className="min-w-[160px] flex-1 bg-transparent py-1 text-sm text-gray-800 outline-none placeholder:text-gray-400 dark:text-gray-100"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          {candidates.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-gray-400">
              {search.trim()
                ? "Nobody matches that search."
                : "Everyone is already added."}
            </p>
          ) : (
            candidates.map((member) => (
              <button
                key={member.id}
                type="button"
                // `onMouseDown` beats the input's blur, which would close this.
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(member.id);
                }}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <UserAvatar
                  name={member.fullName}
                  avatarUrl={member.avatarUrl}
                  color={member.avatarColor}
                  size={28}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-gray-800 dark:text-gray-100">
                    {member.fullName}
                  </span>
                  <span className="block truncate text-xs text-gray-400">
                    {member.email}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
