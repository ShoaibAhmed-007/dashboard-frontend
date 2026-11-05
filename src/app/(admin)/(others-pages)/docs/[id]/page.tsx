"use client";

import { use } from "react";
import DocEditorPage from "@/components/docs/DocEditorPage";

export default function DocPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <div className="h-full overflow-hidden bg-white dark:bg-white/[0.03]">
      <DocEditorPage docId={id} />
    </div>
  );
}
