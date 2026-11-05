"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent, Extension, useEditorState, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import styles from "./RichTextEditor.module.css";
import {
  LuBold, LuItalic, LuUnderline, LuStrikethrough,
  LuList, LuListOrdered, LuQuote,
  LuAlignLeft, LuAlignCenter, LuAlignRight,
  LuHeading1, LuHeading2,
  LuUndo2, LuRedo2, LuMinus, LuPaperclip,
} from "react-icons/lu";
import { uploadAttachment } from "@/lib/uploadAttachment";
import { Attachment } from "@/services/attachment.service";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  taskId?: string;
  userId?: string;
  onAttachmentAdded?: (att: Attachment) => void;
  /** False renders the content read-only, with no toolbar. Defaults to true. */
  editable?: boolean;
}

function Btn({ onClick, active, disabled, title, children }: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-30
        ${active
          ? "bg-brand-100 text-brand-600 dark:bg-brand-900/60 dark:text-brand-300"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
        }`}
    >
      {children}
    </button>
  );
}

const Sep = () => <div className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />;

const ShiftEnter = Extension.create({
  name: "shiftEnter",
  addKeyboardShortcuts() {
    return {
      "Shift-Enter": ({ editor }) => {
        if (editor.isActive("listItem")) return editor.commands.splitListItem("listItem");
        return editor.commands.splitBlock();
      },
    };
  },
});

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Add a description…",
  taskId,
  userId,
  onAttachmentAdded,
  editable = true,
}: Props) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const canUploadImages = Boolean(taskId && userId);

  const insertImage = useCallback(async (file: File) => {
    if (!taskId || !userId) return;
    if (file.size > MAX_FILE_SIZE) { toast.error(`"${file.name}" exceeds 10 MB`); return; }
    if (!file.type.startsWith("image/")) { toast.error("Only image files can be inserted"); return; }

    const toastId = toast.loading(`Uploading ${file.name}…`);
    try {
      const att = await uploadAttachment(file, taskId, userId);
      editorRef.current?.chain().focus().setImage({ src: att.url, alt: att.fileName }).run();
      onAttachmentAdded?.(att);
      toast.success("Image uploaded", { id: toastId });
    } catch {
      toast.error(`Failed to upload "${file.name}"`, { id: toastId });
    }
  }, [taskId, userId, onAttachmentAdded]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] }, hardBreak: false }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      Image.configure({ inline: false, allowBase64: false }),
      ShiftEnter,
    ],
    content: value || "",
    editable,
    onUpdate({ editor }) {
      const html = editor.getHTML();
      const out = html === "<p></p>" ? "" : html;
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => onChange(out), 600);
    },
  });

  // Keep editorRef in sync
  useEffect(() => { editorRef.current = editor; }, [editor]);

  // `editable` can change after mount (e.g. the viewer's role loads).
  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  // Paste handler: intercept image pastes from clipboard
  useEffect(() => {
    if (!canUploadImages || !editor) return;
    const dom = editor.view.dom as HTMLElement;

    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length === 0) return;
      e.preventDefault();
      e.stopPropagation();
      files.forEach((f) => void insertImage(f));
    };

    dom.addEventListener("paste", onPaste);
    return () => dom.removeEventListener("paste", onPaste);
  }, [canUploadImages, editor, insertImage]);

  // Sync external value changes into editor
  const lastSyncedValue = useRef(value);
  useEffect(() => {
    if (!editor || value === lastSyncedValue.current) return;
    lastSyncedValue.current = value;
    const current = editor.getHTML();
    const incoming = value || "";
    if (current !== incoming) editor.commands.setContent(incoming);
  }, [editor, value]);

  useEffect(() => () => { if (saveTimeout.current) clearTimeout(saveTimeout.current); }, []);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isUnderline: ctx.editor?.isActive("underline") ?? false,
      isStrike: ctx.editor?.isActive("strike") ?? false,
      isBullet: ctx.editor?.isActive("bulletList") ?? false,
      isOrdered: ctx.editor?.isActive("orderedList") ?? false,
      isBlockquote: ctx.editor?.isActive("blockquote") ?? false,
      isH1: ctx.editor?.isActive("heading", { level: 1 }) ?? false,
      isH2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      isAlignLeft: ctx.editor?.isActive({ textAlign: "left" }) ?? false,
      isAlignCenter: ctx.editor?.isActive({ textAlign: "center" }) ?? false,
      isAlignRight: ctx.editor?.isActive({ textAlign: "right" }) ?? false,
    }),
  });

  if (!editor) return null;

  const st = editorState ?? {
    canUndo: false, canRedo: false,
    isBold: false, isItalic: false, isUnderline: false, isStrike: false,
    isBullet: false, isOrdered: false, isBlockquote: false,
    isH1: false, isH2: false,
    isAlignLeft: false, isAlignCenter: false, isAlignRight: false,
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach((f) => void insertImage(f));
    e.target.value = "";
  };

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white  shadow-sm transition-all focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-100 dark:border-gray-800 dark:bg-gray-901 dark:focus-within:border-gray-000 dark:focus-within:ring-brand-900/40">

      {/* ── Toolbar ── */}
      {editable && (
      <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50/80 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/50">
        <Btn title="Undo" disabled={!st.canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <LuUndo2 className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Redo" disabled={!st.canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <LuRedo2 className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Heading 1" active={st.isH1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <LuHeading1 className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Heading 2" active={st.isH2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <LuHeading2 className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Bold (⌘B)" active={st.isBold} onClick={() => editor.chain().focus().toggleBold().run()}>
          <LuBold className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Italic (⌘I)" active={st.isItalic} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <LuItalic className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Underline (⌘U)" active={st.isUnderline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <LuUnderline className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Strikethrough" active={st.isStrike} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <LuStrikethrough className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Bullet list" active={st.isBullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <LuList className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Numbered list" active={st.isOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <LuListOrdered className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Blockquote" active={st.isBlockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <LuQuote className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Align left" active={st.isAlignLeft} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <LuAlignLeft className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Align center" active={st.isAlignCenter} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <LuAlignCenter className="h-3.5 w-3.5" />
        </Btn>
        <Btn title="Align right" active={st.isAlignRight} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <LuAlignRight className="h-3.5 w-3.5" />
        </Btn>
        <Sep />
        <Btn title="Divider line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <LuMinus className="h-3.5 w-3.5" />
        </Btn>

        {canUploadImages && (
          <>
            <Sep />
            <Btn title="Attach image" onClick={() => imageInputRef.current?.click()}>
              <LuPaperclip className="h-3.5 w-3.5" />
            </Btn>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageInputChange}
            />
          </>
        )}
      </div>
      )}

      {/* ── Content ── */}
      <div className={`${styles.body} px-4 py-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200`}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
