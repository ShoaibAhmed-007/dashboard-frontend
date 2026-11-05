"use client";

import { useRef, useState } from "react";
import { Editor, useEditorState } from "@tiptap/react";
import {
  LuBold,
  LuItalic,
  LuUnderline,
  LuStrikethrough,
  LuCode,
  LuList,
  LuListOrdered,
  LuListChecks,
  LuQuote,
  LuLink,
  LuImage,
  LuTable,
  LuAlignLeft,
  LuAlignCenter,
  LuAlignRight,
  LuHeading1,
  LuHeading2,
  LuHeading3,
  LuMinus,
  LuUndo2,
  LuRedo2,
  LuMessageSquarePlus,
  LuChevronDown,
} from "react-icons/lu";
import { docAttachmentService } from "@/services/doc-attachment.service";
import { toast } from "sonner";

interface Props {
  editor: Editor | null;
  docId: string;
  disabled?: boolean;
}

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
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
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      className={`flex h-8 w-8 items-center justify-center rounded transition-colors disabled:opacity-30 ${
        active
          ? "bg-brand-100 text-brand-600 dark:bg-brand-900/60 dark:text-brand-300"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-100"
      }`}
    >
      {children}
    </button>
  );
}

const Sep = () => (
  <div className="mx-1 h-5 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
);

export default function DocEditorToolbar({ editor, docId, disabled }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [textMenuOpen, setTextMenuOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);

  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
      isBold: ctx.editor?.isActive("bold") ?? false,
      isItalic: ctx.editor?.isActive("italic") ?? false,
      isUnderline: ctx.editor?.isActive("underline") ?? false,
      isStrike: ctx.editor?.isActive("strike") ?? false,
      isCode: ctx.editor?.isActive("code") ?? false,
      isBullet: ctx.editor?.isActive("bulletList") ?? false,
      isOrdered: ctx.editor?.isActive("orderedList") ?? false,
      isTask: ctx.editor?.isActive("taskList") ?? false,
      isQuote: ctx.editor?.isActive("blockquote") ?? false,
      isH1: ctx.editor?.isActive("heading", { level: 1 }) ?? false,
      isH2: ctx.editor?.isActive("heading", { level: 2 }) ?? false,
      isH3: ctx.editor?.isActive("heading", { level: 3 }) ?? false,
      isLink: ctx.editor?.isActive("link") ?? false,
      isAlignLeft: ctx.editor?.isActive({ textAlign: "left" }) ?? false,
      isAlignCenter: ctx.editor?.isActive({ textAlign: "center" }) ?? false,
      isAlignRight: ctx.editor?.isActive({ textAlign: "right" }) ?? false,
    }),
  });

  if (!editor) return null;
  const st = state ?? {
    canUndo: false,
    canRedo: false,
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isCode: false,
    isBullet: false,
    isOrdered: false,
    isTask: false,
    isQuote: false,
    isH1: false,
    isH2: false,
    isH3: false,
    isLink: false,
    isAlignLeft: false,
    isAlignCenter: false,
    isAlignRight: false,
  };

  const handleImageUpload = async (file: File) => {
    if (imageUploading) return;
    setImageUploading(true);
    const toastId = "img-upload";
    toast.loading("Uploading image…", { id: toastId });
    try {
      // Step 1+2: presign → upload to S3
      const presigned = await docAttachmentService.presign({
        docId,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
      });
      await docAttachmentService.uploadToS3(presigned.uploadUrl, file);

      // Step 3: record attachment in DB
      await docAttachmentService.record({
        docId,
        s3Key: presigned.s3Key,
        fileName: file.name,
        mimeType: file.type || "image/jpeg",
        fileSize: file.size,
      });

      // Step 4: fetch fresh view URL
      const attachments = await docAttachmentService.list(docId);
      const match = attachments.find((a) => a.s3Key === presigned.s3Key || a.fileName === file.name);
      const viewUrl = match?.viewUrl ?? match?.url ?? "";

      // Step 5: insert with s3Key stored as custom attr
      editor.chain().focus().setImage({
        src: viewUrl,
        alt: file.name,
        // @ts-expect-error custom attr defined on DocImage extension
        s3Key: presigned.s3Key,
      }).run();

      toast.success("Image inserted", { id: toastId });
    } catch (e) {
      toast.error("Image upload failed", { id: toastId });
      console.error(e);
    } finally {
      setImageUploading(false);
    }
  };

  const onPickFile = () => fileInputRef.current?.click();

  const onLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const textLabel = st.isH1
    ? "Heading 1"
    : st.isH2
    ? "Heading 2"
    : st.isH3
    ? "Heading 3"
    : "Text";

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-white/95 px-3 py-1.5 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
      <Btn
        title="Undo"
        disabled={disabled || !st.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <LuUndo2 className="h-4 w-4" />
      </Btn>
      <Btn
        title="Redo"
        disabled={disabled || !st.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <LuRedo2 className="h-4 w-4" />
      </Btn>
      <Sep />

      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => {
            e.preventDefault();
            setTextMenuOpen((v) => !v);
          }}
          className="flex h-8 items-center gap-1 rounded px-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-30 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {textLabel}
          <LuChevronDown className="h-3 w-3" />
        </button>
        {textMenuOpen && (
          <div className="absolute left-0 top-9 z-20 w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            {[
              { label: "Text", run: () => editor.chain().focus().setParagraph().run() },
              { label: "Heading 1", run: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
              { label: "Heading 2", run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
              { label: "Heading 3", run: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  item.run();
                  setTextMenuOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <Sep />
      <Btn title="Heading 1" active={st.isH1} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <LuHeading1 className="h-4 w-4" />
      </Btn>
      <Btn title="Heading 2" active={st.isH2} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <LuHeading2 className="h-4 w-4" />
      </Btn>
      <Btn title="Heading 3" active={st.isH3} disabled={disabled} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <LuHeading3 className="h-4 w-4" />
      </Btn>

      <Sep />
      <Btn title="Bold (⌘B)" active={st.isBold} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
        <LuBold className="h-4 w-4" />
      </Btn>
      <Btn title="Italic (⌘I)" active={st.isItalic} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <LuItalic className="h-4 w-4" />
      </Btn>
      <Btn title="Underline (⌘U)" active={st.isUnderline} disabled={disabled} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <LuUnderline className="h-4 w-4" />
      </Btn>
      <Btn title="Strikethrough" active={st.isStrike} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <LuStrikethrough className="h-4 w-4" />
      </Btn>
      <Btn title="Inline code" active={st.isCode} disabled={disabled} onClick={() => editor.chain().focus().toggleCode().run()}>
        <LuCode className="h-4 w-4" />
      </Btn>

      <Sep />
      <Btn title="Bullet list" active={st.isBullet} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <LuList className="h-4 w-4" />
      </Btn>
      <Btn title="Numbered list" active={st.isOrdered} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <LuListOrdered className="h-4 w-4" />
      </Btn>
      <Btn title="Task list" active={st.isTask} disabled={disabled} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <LuListChecks className="h-4 w-4" />
      </Btn>
      <Btn title="Blockquote" active={st.isQuote} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <LuQuote className="h-4 w-4" />
      </Btn>

      <Sep />
      <Btn title="Align left" active={st.isAlignLeft} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
        <LuAlignLeft className="h-4 w-4" />
      </Btn>
      <Btn title="Align center" active={st.isAlignCenter} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
        <LuAlignCenter className="h-4 w-4" />
      </Btn>
      <Btn title="Align right" active={st.isAlignRight} disabled={disabled} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
        <LuAlignRight className="h-4 w-4" />
      </Btn>

      <Sep />
      <Btn title="Link" active={st.isLink} disabled={disabled} onClick={onLink}>
        <LuLink className="h-4 w-4" />
      </Btn>
      <Btn title="Image" disabled={disabled || imageUploading} onClick={onPickFile}>
        {imageUploading
          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
          : <LuImage className="h-4 w-4" />}
      </Btn>
      <Btn
        title="Insert table"
        disabled={disabled}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      >
        <LuTable className="h-4 w-4" />
      </Btn>
      <Btn title="Divider" disabled={disabled} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <LuMinus className="h-4 w-4" />
      </Btn>
      <Btn title="Comment thread (coming soon)" disabled onClick={() => undefined}>
        <LuMessageSquarePlus className="h-4 w-4" />
      </Btn>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
