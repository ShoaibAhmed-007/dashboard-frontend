"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LuLock, LuChevronRight, LuEllipsis } from "react-icons/lu";
import { docsService, type Doc } from "@/services/docs.service";
import { docAttachmentService } from "@/services/doc-attachment.service";
import { useDocs } from "@/context/DocsContext";
import {
  useDocSocket,
  type BlockLock,
  type PresenceUser,
} from "@/hooks/useDocSocket";
import { useAuth } from "@/context/AuthContext";
import { useProjects } from "@/context/ProjectContext";
import { parseApiError } from "@/lib/api";
import TipTapEditor, { type TipTapEditorHandle } from "./TipTapEditor";
import DocEditorToolbar from "./DocEditorToolbar";
import DocPresenceAvatars from "./DocPresenceAvatars";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export default function DocEditorPage({ docId }: { docId: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { projects } = useProjects();
  const { upsertLocal, updateDoc, deleteDoc } = useDocs();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patchedContent, setPatchedContent] = useState<Record<string, unknown> | null>(null);
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [locks, setLocks] = useState<BlockLock[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [titleDraft, setTitleDraft] = useState("");

  const editorRef = useRef<TipTapEditorHandle>(null);
  const baseVersionRef = useRef<number>(0);
  const focusedBlockRef = useRef<string | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lockedByOthers = useMemo(() => {
    const set = new Set<string>();
    if (!user) return set;
    for (const l of locks) {
      if (l.userId !== user.id) set.add(l.blockId);
    }
    return set;
  }, [locks, user]);

  const project = useMemo(
    () => (doc?.projectId ? projects.find((p) => p.id === doc.projectId) : null),
    [doc?.projectId, projects]
  );

  const socket = useDocSocket(docId, {
    onPresenceSnapshot: (users) => setPresence(users),
    onLockSnapshot: (l) => setLocks(l),
    onSaved: ({ doc: serverDoc }) => {
      baseVersionRef.current = serverDoc.version;
      setDoc(serverDoc);
      setTitleDraft(serverDoc.title);
      upsertLocal(serverDoc);
      // Replace editor content with authoritative server JSON (server may have reassigned IDs).
      editorRef.current?.setContent(
        serverDoc.contentJson as Record<string, unknown>
      );
      setSaveStatus("saved");
    },
    onSaveConflict: ({ reason }) => {
      if (reason === "Autosave throttled") {
        // silent retry handled by debounce
        return;
      }
      if (
        reason === "Stale save overlaps with server changes" ||
        reason === "Base version is no longer available"
      ) {
        toast.info("Doc updated by another editor — reloading");
        reloadDoc();
        return;
      }
      if (reason === "Modified blocks must be locked by the saving user") {
        const blockId = focusedBlockRef.current;
        if (blockId) {
          socket.lockBlock(blockId);
          // retry the save shortly after lock acquisition
          setTimeout(triggerSave, 250);
        }
        return;
      }
      toast.error(reason);
      setSaveStatus("error");
    },
    onLockRejected: () => {
      toast.warning("Block is being edited by another user");
    },
  });

  /** Walk the TipTap JSON tree and replace stale image src with fresh presigned URLs. */
  const patchImageUrls = useCallback(
    async (contentJson: Record<string, unknown>) => {
      try {
        const attachments = await docAttachmentService.list(docId);
        if (!attachments.length) return contentJson;
        const urlMap = new Map(attachments.map((a) => [a.s3Key, a.url ?? a.viewUrl ?? ""]));

        const walk = (node: Record<string, unknown>) => {
          if (node.type === "image") {
            const attrs = (node.attrs ?? {}) as Record<string, unknown>;
            const key = attrs.s3Key as string | undefined;
            if (key && urlMap.has(key)) {
              attrs.src = urlMap.get(key);
              node.attrs = attrs;
            }
          }
          const children = node.content as Record<string, unknown>[] | undefined;
          children?.forEach(walk);
        };

        // deep clone so we don't mutate the stored doc
        const patched = JSON.parse(JSON.stringify(contentJson)) as Record<string, unknown>;
        walk(patched);
        return patched;
      } catch {
        return contentJson;
      }
    },
    [docId]
  );

  const reloadDoc = useCallback(async () => {
    try {
      const d = await docsService.get(docId);
      baseVersionRef.current = d.version;
      setDoc(d);
      setTitleDraft(d.title);
      upsertLocal(d);
      const patched = await patchImageUrls(d.contentJson as Record<string, unknown>);
      editorRef.current?.setContent(patched);
    } catch (e) {
      setLoadError(parseApiError(e).message);
    }
  }, [docId, upsertLocal, patchImageUrls]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      docsService.get(docId),
      docAttachmentService.list(docId).catch(() => []),
    ]).then(async ([d, attachments]) => {
        if (!alive) return;
        setDoc(d);
        setTitleDraft(d.title);
        baseVersionRef.current = d.version;
        upsertLocal(d);

        // Patch stale image src values before setting editor content
        const urlMap = new Map(attachments.map((a) => [a.s3Key, a.url ?? a.viewUrl ?? ""]));
        const patched = JSON.parse(JSON.stringify(d.contentJson)) as Record<string, unknown>;
        const walk = (node: Record<string, unknown>) => {
          if (node.type === "image") {
            const attrs = (node.attrs ?? {}) as Record<string, unknown>;
            const key = attrs.s3Key as string | undefined;
            if (key && urlMap.has(key)) { attrs.src = urlMap.get(key); node.attrs = attrs; }
          }
          (node.content as Record<string, unknown>[] | undefined)?.forEach(walk);
        };
        walk(patched);
        setPatchedContent(patched);
      })
      .catch((e) => {
        if (!alive) return;
        setLoadError(parseApiError(e).message);
      });
    return () => { alive = false; };
  }, [docId, upsertLocal]);

  const triggerSave = useCallback(async () => {
    const editor = editorRef.current?.editor;
    if (!editor || !doc) return;
    setSaveStatus("saving");
    try {
      const updated = await docsService.update(doc.id, {
        contentJson: editor.getJSON(),
      });
      baseVersionRef.current = updated.version;
      setDoc(updated);
      upsertLocal(updated);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }, [doc, upsertLocal]);

  const handleEditorUpdate = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void triggerSave(); }, 2000);
  }, [triggerSave]);

  const handleBlockFocus = useCallback(
    (blockId: string | null) => {
      const prev = focusedBlockRef.current;
      if (prev === blockId) return;
      if (prev) {
        socket.unlockBlock(prev);
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }
      }
      focusedBlockRef.current = blockId;
      if (blockId) {
        socket.lockBlock(blockId);
        heartbeatRef.current = setInterval(() => {
          socket.lockHeartbeat(blockId);
        }, 10_000);
      }
    },
    [socket]
  );

  // Push patched content (with fresh image URLs) into the editor once available
  useEffect(() => {
    if (patchedContent) {
      editorRef.current?.setContent(patchedContent);
    }
  }, [patchedContent]);

  useEffect(() => {
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      const blockId = focusedBlockRef.current;
      if (blockId) socket.unlockBlock(blockId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commitTitle = async () => {
    if (!doc) return;
    const trimmed = titleDraft.trim() || "Untitled";
    if (trimmed === doc.title) return;
    try {
      const updated = await updateDoc(doc.id, { title: trimmed });
      setDoc(updated);
    } catch (e) {
      toast.error(parseApiError(e).message);
      setTitleDraft(doc.title);
    }
  };

  const handleDelete = async () => {
    if (!doc) return;
    if (!window.confirm("Delete this doc?")) return;
    try {
      await deleteDoc(doc.id);
      toast.success("Doc deleted");
      router.push(doc.projectId ? `/projects` : "/docs");
    } catch (e) {
      toast.error(parseApiError(e).message);
    }
  };

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-500">
        {loadError}
      </div>
    );
  }
  if (!doc) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  const breadcrumb = (
    <nav className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
      {project ? (
        <>
          <Link href="/projects" className="hover:text-gray-700 dark:hover:text-gray-200">
            Projects
          </Link>
          <LuChevronRight className="h-3 w-3" />
          <Link
            href={`/projects?projectId=${project.id}`}
            className="hover:text-gray-700 dark:hover:text-gray-200"
          >
            {project.name}
          </Link>
          <LuChevronRight className="h-3 w-3" />
        </>
      ) : (
        <>
          <Link href="/docs" className="hover:text-gray-700 dark:hover:text-gray-200">
            {doc.scope === "PERSONAL" ? "Personal Docs" : "Workspace Docs"}
          </Link>
          <LuChevronRight className="h-3 w-3" />
        </>
      )}
      <span className="truncate text-gray-700 dark:text-gray-200">{doc.title}</span>
    </nav>
  );

  return (
    <div className="flex h-full flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-3 dark:border-gray-800">
        <div className="min-w-0 flex-1">{breadcrumb}</div>
        <div className="flex items-center gap-3">
          <DocPresenceAvatars users={presence} />
          <SaveIndicator status={saveStatus} />
          <StubButton label="Share" />
          <StubButton label="Version history" />
          <StubButton label="Export" />
          <button
            type="button"
            onClick={handleDelete}
            title="More"
            className="rounded p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            <LuEllipsis className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <DocEditorToolbar editor={editorRef.current?.editor ?? null} docId={doc.id} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <div className="mb-4 flex items-center gap-2">
            {doc.scope === "PERSONAL" && (
              <LuLock className="h-5 w-5 text-gray-400" />
            )}
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="Untitled"
              className="w-full bg-transparent text-3xl font-bold text-gray-900 outline-none placeholder:text-gray-300 dark:text-white dark:placeholder:text-gray-600"
            />
          </div>

          <TipTapEditor
            ref={editorRef}
            initialContent={patchedContent ?? doc.contentJson as Record<string, unknown>}
            editable
            onUpdate={handleEditorUpdate}
            onBlockFocus={handleBlockFocus}
            lockedBlockIds={lockedByOthers}
          />
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    if (status !== "saved") return;
    const t = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(t);
  }, [status]);

  if (!visible || status === "idle") return null;

  const map: Record<SaveStatus, { label: string; cls: string }> = {
    idle: { label: "", cls: "" },
    saving: { label: "Saving…", cls: "text-gray-400 dark:text-gray-500" },
    saved: { label: "Saved", cls: "text-emerald-600 dark:text-emerald-400" },
    error: { label: "Save failed", cls: "text-red-500" },
  };
  const m = map[status];
  return (
    <span className={`text-xs transition-opacity duration-500 ${m.cls}`}>
      {m.label}
    </span>
  );
}

function StubButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming soon"
      className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed dark:text-gray-500 dark:hover:bg-gray-800"
    >
      {label}
    </button>
  );
}
