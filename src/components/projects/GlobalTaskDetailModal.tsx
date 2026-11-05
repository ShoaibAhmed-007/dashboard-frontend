"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useTaskStore } from "@/stores/task.store";
import { statusService, StatusItem, flattenGroupedStatuses } from "@/services/status.service";
import TaskDetailModal from "./TaskDetailModal";
import MinimizedTaskBar from "./MinimizedTaskBar";

export default function GlobalTaskDetailModal() {
  const { openTask, openTaskLoading, closeTaskDetail, minimizeTask } = useTaskStore();
  const pathname = usePathname();
  const [statuses, setStatuses] = useState<StatusItem[]>([]);

  useEffect(() => {
    if (!openTask) return;
    const projectId = openTask.list.project.id;
    statusService
      .list(projectId)
      .then((grouped) => setStatuses(flattenGroupedStatuses(grouped)))
      .catch(() => setStatuses([]));
  }, [openTask?.list.project.id]);

  // TasksPage renders its own modal — skip here to avoid duplicating it
  if (pathname?.startsWith("/projects")) return null;

  return (
    <>
      {openTask && !openTaskLoading && (
        <TaskDetailModal
          key={openTask.id}
          task={openTask}
          statuses={statuses}
          listId={openTask.list.id}
          onClose={closeTaskDetail}
          onMinimize={minimizeTask}
        />
      )}
      <MinimizedTaskBar />
    </>
  );
}
