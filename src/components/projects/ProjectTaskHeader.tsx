"use client";

import TaskScopeHeader from "./TaskScopeHeader";

interface ProjectTaskHeaderProps {
  searchValue: string;
  filterCount: number;
  onSearchChange: (value: string) => void;
  onOpenFilters: (rect: DOMRect) => void;
  onAddTask: () => void;
}

export default function ProjectTaskHeader(props: ProjectTaskHeaderProps) {
  return <TaskScopeHeader title="Entire Project" {...props} />;
}
