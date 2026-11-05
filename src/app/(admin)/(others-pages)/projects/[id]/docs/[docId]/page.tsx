"use client";

import { use } from "react";
import DocEditorPage from "@/components/docs/DocEditorPage";

export default function ProjectDocPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>;
}) {
  const { docId } = use(params);
  return (
    <div className="h-full overflow-hidden bg-white dark:bg-white/[0.03]">
      <DocEditorPage docId={docId} />
    </div>
  );
}
