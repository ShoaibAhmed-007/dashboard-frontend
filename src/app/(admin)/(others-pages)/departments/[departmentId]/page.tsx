import { Metadata } from "next";
import DepartmentMeetingsRoute from "@/components/departments/DepartmentMeetingsRoute";

export const metadata: Metadata = {
  title: "Department meetings",
};

export default function DepartmentMeetingsRoutePage() {
  return <DepartmentMeetingsRoute />;
}
