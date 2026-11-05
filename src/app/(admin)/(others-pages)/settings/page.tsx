"use client";

import { useSearchParams } from "next/navigation";
import MySettingsPage from "@/components/settings/MySettingsPage";
import { WorkspaceSettingsContent } from "@/components/workspace/WorkspaceSettingsPage";

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") ?? "general").toLowerCase();

  if (tab === "preferences") {
    return <MySettingsPage />;
  }

  return <WorkspaceSettingsContent tab={tab} />;
}
