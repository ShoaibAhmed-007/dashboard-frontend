"use client";

import TaskScopeHeader from "./TaskScopeHeader";

interface ListTaskHeaderProps {
  listName: string;
  searchValue: string;
  filterCount: number;
  onSearchChange: (value: string) => void;
  onOpenFilters: (rect: DOMRect) => void;
  onAddTask: () => void;
}

export default function ListTaskHeader({
  listName,
  ...props
}: ListTaskHeaderProps) {
  return <TaskScopeHeader title={`List: ${listName}`} {...props} />;
}
