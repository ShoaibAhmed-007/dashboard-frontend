"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { LuSearch, LuUserPlus, LuX } from "react-icons/lu";
import { channelService } from "@/services/channel.service";
import { parseApiError } from "@/lib/api";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useAuthStore } from "@/stores/auth.store";
import { useChatStore } from "@/stores/chat.store";
import ChatAvatar from "./ChatAvatar";
import type { ChatChannel } from "@/types/chat";

/**
 * A channel's people: who is in it, and — for anyone allowed to manage it —
 * who else in the workspace could be added.
 *
 * A public channel *is* the workspace: the server enrols every workspace
 * member on creation and every later joiner as they arrive
 * (`joinAllPublicChannels`), so there is nobody to add and removing someone
 * would only break that invariant until they next rejoin. Public channels
 * therefore show the roster alone. Private channels are invite-only and get
 * both lists — who is in, and who else could be.
 */
export default function ChannelMembersSection({
  channel,
}: {
  channel: ChatChannel;
}) {
  const selfId = useAuthStore((s) => s.user?.id);
  const upsertChannel = useChatStore((s) => s.upsertChannel);
  const { members: workspaceMembers } = useWorkspaceMembers();

  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  /* `?? []` inline would allocate a fresh array on every render, so the memo
     below would never hit — the same trap that caused a render loop in the
     message list. */
  const members = useMemo(() => channel.members ?? [], [channel.members]);

  /* Add/remove are OWNER/ADMIN only server-side ("Only channel admins can add
     members"), so the controls are hidden rather than left to fail on click. */
  const myRole = members.find((m) => m.userId === selfId)?.role;
  const isPrivate = channel.privacy === "PRIVATE";
  /* The server would accept add/remove on a public channel too, but both
     contradict "everyone is in it" — so the controls are private-only. */
  const canManage = isPrivate && (myRole === "OWNER" || myRole === "ADMIN");

  /* Everyone in the workspace who is not already in the channel — the second
     list, and the only source a member can be added from. */
  const addable = useMemo(() => {
    const present = new Set(members.map((m) => m.userId));
    const needle = search.trim().toLowerCase();
    return workspaceMembers
      .filter((w) => !present.has(w.id))
      .filter(
        (w) =>
          !needle ||
          w.fullName.toLowerCase().includes(needle) ||
          w.email.toLowerCase().includes(needle)
      );
  }, [workspaceMembers, members, search]);

  /* The channel list is the only source of `members`, and it is not refetched
     here — so the store row is patched in place to keep both lists honest. */
  const applyMembers = (next: typeof members) =>
    upsertChannel({ ...channel, members: next });

  const add = async (person: (typeof workspaceMembers)[number]) => {
    setBusyUserId(person.id);
    try {
      const added = await channelService.addMember(
        channel.id,
        person.id,
        "member"
      );
      /* The endpoint creates the row without an `include`, so its response
         carries no nested `user` — rendering it directly would show a blank
         name. The identity is taken from the workspace record that was just
         picked, which is the same person by construction. */
      applyMembers([
        ...members,
        {
          ...added,
          user: added.user ?? {
            id: person.id,
            fullName: person.fullName,
            avatarUrl: null,
          },
        },
      ]);
      toast.success(`${person.fullName} added.`);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't add that person.");
    } finally {
      setBusyUserId(null);
    }
  };

  const remove = async (member: (typeof members)[number]) => {
    setBusyUserId(member.userId);
    try {
      /* The route takes the *membership* row id, not the user id — passing
         `userId` here silently 404s. */
      await channelService.removeMember(channel.id, member.id);
      applyMembers(members.filter((m) => m.id !== member.id));
      toast.success(`${member.user.fullName} removed.`);
    } catch (err) {
      toast.error(parseApiError(err).message || "Couldn't remove that person.");
    } finally {
      setBusyUserId(null);
    }
  };

  /* Mirrors the server's own guards, so a control is never offered for an
     action it would reject: you cannot remove yourself or the owner, and only
     the owner may remove an admin. */
  const canRemove = (member: (typeof members)[number]) => {
    if (!canManage) return false;
    if (member.userId === selfId) return false;
    if (member.role === "OWNER") return false;
    if (member.role === "ADMIN" && myRole !== "OWNER") return false;
    return true;
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
          Members
          <span className="ml-1.5 font-normal text-gray-400">
            {members.length}
          </span>
          {!isPrivate && (
            <span className="ml-1.5 font-normal text-gray-400">
              · everyone in the workspace
            </span>
          )}
        </p>
        {canManage && (
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-brand-500 transition-colors hover:bg-brand-50 dark:hover:bg-brand-500/10"
          >
            {picking ? (
              <>
                <LuX className="h-3 w-3" />
                Done
              </>
            ) : (
              <>
                <LuUserPlus className="h-3 w-3" />
                Add
              </>
            )}
          </button>
        )}
      </div>

      {/* Who is in the channel */}
      <ul className="mt-3 space-y-1">
        {members.map((member) => (
          <li key={member.id} className="group flex items-center gap-2.5">
            <ChatAvatar
              name={member.user.fullName}
              avatarUrl={member.user.avatarUrl}
              size={28}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-gray-700 dark:text-gray-200">
                {member.user.fullName}
                {member.userId === selfId && (
                  <span className="ml-1 text-gray-400">(you)</span>
                )}
              </span>
              {member.role !== "MEMBER" && (
                <span className="block text-[10px] uppercase tracking-wide text-gray-400">
                  {member.role}
                </span>
              )}
            </span>
            {canRemove(member) && (
              <button
                type="button"
                onClick={() => void remove(member)}
                disabled={busyUserId === member.userId}
                aria-label={`Remove ${member.user.fullName}`}
                title="Remove from channel"
                className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-40"
              >
                <LuX className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {/* Who else could be added */}
      {picking && (
        <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
          <div className="relative">
            <LuSearch className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspace"
              aria-label="Search people to add"
              className="h-8 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-2 text-xs text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>

          {addable.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-gray-400">
              {search.trim()
                ? "Nobody matches that search."
                : "Everyone is already in this channel."}
            </p>
          ) : (
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {addable.map((person) => (
                <li key={person.id} className="flex items-center gap-2.5">
                  <ChatAvatar
                    name={person.fullName}
                    avatarUrl={person.avatarUrl}
                    size={28}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-gray-700 dark:text-gray-200">
                      {person.fullName}
                    </span>
                    <span className="block truncate text-[10px] text-gray-400">
                      {person.email}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void add(person)}
                    disabled={busyUserId === person.id}
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-brand-500 transition-colors hover:bg-brand-50 disabled:opacity-40 dark:hover:bg-brand-500/10"
                  >
                    {busyUserId === person.id ? "Adding…" : "Add"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
