"use client";

import { useParams } from "next/navigation";
import MomPage from "@/components/mom/MomPage";

/** Resolves `/departments/[departmentId]` — see MomPage's `departmentId` prop. */
export default function DepartmentMeetingsRoute() {
  const params = useParams<{ departmentId: string }>();
  return <MomPage departmentId={params.departmentId} />;
}
