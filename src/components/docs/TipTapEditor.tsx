"use client";

import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import { useEditor, EditorContent, Editor, Extension } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Placeholder from "@tiptap/extension-placeholder";
import { Link } from "@tiptap/extension-link";
import { Image } from "@tiptap/extension-image";

// Custom image extension that persists s3Key as a stable attribute.
// src (presigned URL) expires — s3Key never does.
const DocImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      s3Key: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-s3-key"),
        renderHTML: (attrs) =>
          attrs.s3Key ? { "data-s3-key": attrs.s3Key } : {},
      },
    };
  },
}).configure({ inline: false, allowBase64: false });
import { Highlight } from "@tiptap/extension-highlight";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { Table, TableRow, TableCell, TableHeader } from "@tiptap/extension-table";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { UniqueID } from "@tiptap/extension-unique-id";

const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "codeBlock",
  "blockquote",
  "image",
  "horizontalRule",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
];

export interface TipTapEditorHandle {
  editor: Editor | null;
  setContent: (json: Record<string, unknown>) => void;
}

interface Props {
  initialContent: Record<string, unknown> | null;
  editable: boolean;
  onUpdate: (json: Record<string, unknown>) => void;
  onBlockFocus: (blockId: string | null) => void;
  lockedBlockIds: Set<string>;
  placeholder?: string;
}

const TipTapEditor = forwardRef<TipTapEditorHandle, Props>(function TipTapEditor(
  {
    initialContent,
    editable,
    onUpdate,
    onBlockFocus,
    lockedBlockIds,
    placeholder = "Start writing…",
  },
  ref
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onBlockFocusRef = useRef(onBlockFocus);
  onBlockFocusRef.current = onBlockFocus;
  const lockedRef = useRef(lockedBlockIds);
  lockedRef.current = lockedBlockIds;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Extension.create({
        name: "shiftEnterInList",
        priority: 1000,
        addKeyboardShortcuts() {
          return {
            "Shift-Enter": ({ editor }) => {
              if (editor.isActive("listItem")) {
                return editor.commands.splitListItem("listItem");
              }
              if (editor.isActive("taskItem")) {
                return editor.commands.splitListItem("taskItem");
              }
              return false;
            },
          };
        },
      }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      DocImage,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TaskList,
      TaskItem.configure({ nested: true }),
      UniqueID.configure({
        types: BLOCK_TYPES,
        attributeName: "id",
      }),
    ],
    content: initialContent ?? { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate({ editor }) {
      onUpdateRef.current(editor.getJSON());
    },
    onSelectionUpdate({ editor }) {
      const node = editor.state.selection.$from.node(1);
      const id = (node?.attrs?.id as string | undefined) ?? null;
      onBlockFocusRef.current(id);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      editor,
      setContent: (json) => {
        if (!editor) return;
        editor.commands.setContent(json, { emitUpdate: false });
      },
    }),
    [editor]
  );

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  if (!editor) return null;

  return (
    <div className="tiptap-doc">
      <EditorContent editor={editor} />
      <style jsx global>{`
        .tiptap-doc .ProseMirror {
          min-height: 60vh;
          padding: 1.5rem 0;
          outline: none;
        }
        .tiptap-doc .ProseMirror h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 1.5rem 0 0.75rem;
        }
        .tiptap-doc .ProseMirror h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.25rem 0 0.5rem;
        }
        .tiptap-doc .ProseMirror h3 {
          font-size: 1.2rem;
          font-weight: 600;
          margin: 1rem 0 0.5rem;
        }
        .tiptap-doc .ProseMirror p {
          line-height: 1.7;
          margin: 0.5rem 0;
        }
        .tiptap-doc .ProseMirror ul,
        .tiptap-doc .ProseMirror ul li {
          list-style: disc !important;
          padding-left: 1.5rem;
        }
        .tiptap-doc .ProseMirror ul ul,
        .tiptap-doc .ProseMirror ul ul li {
          list-style-type: circle !important;
        }
        .tiptap-doc .ProseMirror ul ul ul,
        .tiptap-doc .ProseMirror ul ul ul li {
          list-style-type: square !important;
        }
        .tiptap-doc .ProseMirror ol,
        .tiptap-doc .ProseMirror ol li {
          list-style: decimal !important;
          padding-left: 1.5rem;
        }
        .tiptap-doc .ProseMirror ol ol,
        .tiptap-doc .ProseMirror ol ol li {
          list-style-type: lower-alpha !important;
        }
        .tiptap-doc .ProseMirror li {
          display: list-item !important;
          list-style-position: outside;
        }
        .tiptap-doc .ProseMirror li p {
          margin: 0;
        }
        .tiptap-doc .ProseMirror code {
          background: rgba(135, 131, 120, 0.15);
          padding: 0.15em 0.35em;
          border-radius: 4px;
          font-size: 0.9em;
        }
        .tiptap-doc .ProseMirror pre {
          background: #0d1117;
          color: #e6edf3;
          padding: 1rem;
          border-radius: 6px;
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .tiptap-doc .ProseMirror blockquote {
          border-left: 3px solid #d4d4d8;
          padding-left: 1rem;
          color: #71717a;
          margin: 0.5rem 0;
        }
        .tiptap-doc .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        .tiptap-doc .ProseMirror th,
        .tiptap-doc .ProseMirror td {
          border: 1px solid #e5e7eb;
          padding: 0.5rem;
        }
        .tiptap-doc .ProseMirror th {
          background: #f9fafb;
          font-weight: 600;
        }
        .tiptap-doc .ProseMirror img {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 1rem 0;
          box-shadow: 0 1px 4px rgba(0,0,0,0.08);
        }
        .tiptap-doc .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #6366f1;
          outline-offset: 2px;
        }
        .tiptap-doc .ProseMirror hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1.5rem 0;
        }
        .tiptap-doc .ProseMirror p.is-editor-empty:first-child::before {
          color: #9ca3af;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap-doc .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        .tiptap-doc .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          gap: 0.5rem;
          align-items: flex-start;
        }
      `}</style>
    </div>
  );
});

export default TipTapEditor;
