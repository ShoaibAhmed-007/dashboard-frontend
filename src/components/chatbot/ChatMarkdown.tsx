"use client";

import React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { LuCopy, LuCheck } from "react-icons/lu";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const { copy, copied } = useCopyToClipboard();
  const codeText = extractText(children);

  return (
    <div className="group relative">
      <pre className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 overflow-x-auto mb-2 last:mb-0 text-[13px] font-mono">
        {children}
      </pre>
      <button
        type="button"
        onClick={() => copy(codeText)}
        title="Copy code"
        className="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-md bg-gray-200/80 dark:bg-gray-700/80 text-gray-500 dark:text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-opacity"
      >
        {copied ? <LuCheck className="w-3.5 h-3.5" /> : <LuCopy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

const components: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-500 hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-500 dark:text-gray-400 mb-2 last:mb-0">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-800" />,
  h1: ({ children }) => (
    <h1 className="text-base font-semibold text-gray-900 dark:text-white mt-3 mb-2 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white mt-3 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mt-3 mb-2 first:mt-0">{children}</h3>
  ),
  pre: CodeBlock,
  code: ({ className, children }) => {
    const isFenced = /language-/.test(className || "");
    if (isFenced) {
      return <code className={className}>{children}</code>;
    }
    return (
      <code className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[13px] font-mono">
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2 last:mb-0">
      <table className="border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-200 dark:border-gray-700 px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-200 dark:border-gray-700 px-2 py-1">{children}</td>
  ),
};

export default function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="text-sm text-gray-700 dark:text-gray-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
