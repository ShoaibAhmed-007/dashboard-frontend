"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import Select from "@/components/form/Select";
import { useOptionalProjects } from "@/context/ProjectContext";
import { useOptionalTaskLists } from "@/context/TaskListContext";
import { parseApiError } from "@/lib/api";
import { TaskList } from "@/services/task-list.service";
import { toast } from "sonner";

interface CreateListModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProjectId?: string | null;
  lockProject?: boolean;
  onCreated?: (list: TaskList) => void;
}

export default function CreateListModal({
  isOpen,
  onClose,
  initialProjectId,
  lockProject = false,
  onCreated,
}: CreateListModalProps) {
  const router = useRouter();
  const { projects } = useOptionalProjects();
  const { createList } = useOptionalTaskLists();
  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [loading, setLoading] = useState(false);

  const resolvedProjectId = useMemo(() => {
    if (initialProjectId) return initialProjectId;
    if (projectId) return projectId;
    return projects[0]?.id ?? "";
  }, [initialProjectId, projectId, projects]);

  useEffect(() => {
    if (!isOpen) return;
    setName("");
    setProjectId(initialProjectId ?? projects[0]?.id ?? "");
    setLoading(false);
  }, [initialProjectId, isOpen, projects]);

  const selectedProject = projects.find((p) => p.id === resolvedProjectId);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!resolvedProjectId || !name.trim()) return;

    setLoading(true);
    try {
      const created = await createList(resolvedProjectId, { name: name.trim() });
      onCreated?.(created);
      toast.success(`List "${created.name}" created`);
      onClose();
      router.push(`/projects?projectId=${created.projectId}&listId=${created.id}&view=list`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-9 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-800 outline-none transition-colors focus:border-brand-500 dark:focus:border-gray-000 dark:border-gray-800 dark:bg-gray-905 dark:text-white";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="mx-4 max-w-xl"
      backdropClassName="fixed inset-0 h-full w-full bg-black/30"
    >
      <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-907">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <h2 className="text-base font-normal text-gray-800 dark:text-white">
            Create List
          </h2>
        </div>

        <div className="space-y-4 px-6 py-4">
          <div>
            <label className="mb-2 block text-sm font-normal text-gray-700 dark:text-gray-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your list or project name"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-normal text-gray-700 dark:text-gray-300">
              Project (location)
            </label>
            <Select
              options={projects.map((p) => ({ value: p.id, label: p.name }))}
              value={resolvedProjectId}
              onChange={setProjectId}
              disabled={lockProject}
              placeholder="Select a project"
              size="md"
              hint={
                selectedProject
                  ? <>New list will be created inside <span className="font-normal text-gray-500">{selectedProject.name}</span>.</>
                  : undefined
              }
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button
            type="button"
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-normal text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Use Templates
          </button>
          <button
            type="submit"
            disabled={loading || !name.trim() || !resolvedProjectId}
            className="rounded-xl bg-brand-500 dark:bg-gray-000 dark:text-black dark:hover:bg-gray-200 px-6 py-2.5 text-sm font-normal text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
