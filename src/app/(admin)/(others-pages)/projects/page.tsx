import { Metadata } from "next";
import TasksPage from "@/components/projects/TasksPage";

export const metadata: Metadata = {
  title: "Task Management | TailAdmin - Next.js Dashboard Template",
  description: "Manage and track your team's tasks with list and Kanban board views.",
};

export default function Tasks() {
  return (
    <div className="h-full overflow-y-auto bg-white p-5 dark:bg-gray-900 lg:px-6 lg:py-3">
      <TasksPage />
    </div>
  );
}
