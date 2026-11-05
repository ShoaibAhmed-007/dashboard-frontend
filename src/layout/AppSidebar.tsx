"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useOptionalProjects } from "@/context/ProjectContext";
import { useOptionalTaskLists } from "@/context/TaskListContext";
import { Project, projectService } from "@/services/project.service";
import { taskService } from "@/services/task.service";
import { useUiStore } from "@/stores/ui.store";
import { useFavorites } from "@/hooks/useFavorites";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useWorkspaceManageAccess } from "@/hooks/useWorkspaceManageAccess";
import { useMyDepartment } from "@/hooks/useMyDepartment";
import { useItManagerAccess } from "@/hooks/useItManagerAccess";
import { TaskList } from "@/services/task-list.service";
import { parseApiError } from "@/lib/api";
import InvitePeopleModal from "@/components/workspace/InvitePeopleModal";
import CreateSpaceModal from "@/components/projects/CreateSpaceModal";
import EditSpaceModal from "@/components/projects/EditSpaceModal";
import SpaceContextMenu from "@/components/projects/SpaceContextMenu";
import ConfirmActionModal from "@/components/common/ConfirmActionModal";
import CreateListModal from "@/components/projects/CreateListModal";
import ProjectMembersModal from "@/components/projects/ProjectMembersModal";
import ListContextMenu from "@/components/projects/ListContextMenu";
import DocsListSidebarSection from "@/components/docs/DocsListSidebarSection";
import ChatbotPanelContent from "@/components/chatbot/ChatbotPanelContent";
import { ICON_MAP } from "@/components/projects/IconColorPicker";
import { toast } from "sonner";
import { RiInbox2Fill } from "react-icons/ri";
import { BsReply,BsPersonCheck,BsPersonWorkspace  } from "react-icons/bs";
import { GoPersonAdd } from "react-icons/go";
import {
  LuUsers,
  LuBuilding2,
  LuUserPlus,
  LuClock,
  LuCalendar,
  LuTarget,
  LuShieldCheck,
  LuGraduationCap,
  LuShield,
  LuFileText,
  LuArrowLeftRight,
  LuUsersRound,
  LuPlus,




  LuSettings,
  LuChevronRight,
  LuLogOut,
  LuChevronDown,
  LuSlidersHorizontal,
  LuEllipsis as LuMoreHorizontal,
  LuStar,
  LuArchive,
  LuLock,
  LuLayoutGrid,
  LuBookOpen,
  LuPlay,
  LuBotMessageSquare,
  LuMessageSquare,
  LuKanban,
  LuBriefcase,
  LuBriefcaseBusiness,
  LuStore,
  LuLandmark,
  LuArrowLeft,
  LuMonitor,
  LuHardDrive,
  LuClipboardList,
  LuClipboardCheck,
  LuReceipt,
} from "react-icons/lu";
import { MdChecklist } from "react-icons/md";
import { ssoService } from "@/services/sso.service";

// ── Icon Rail items ──────────────────────────────────────────────────────────
type RailItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  panel: "home" | "lms" | "chat" | "chatbot" | "mom" | "accounts" | "it" | "ai" | "teams" | "clips" | "more" | "hr";
};

const railItems: RailItem[] = [
  { id: "accounts", label: "Dashboard", icon: <LuLandmark className="w-5 h-5" />, panel: "accounts" },
  { id: "home", label: "Projects", icon: <LuKanban className="w-5 h-5" />, panel: "home" },
  { id: "lms",  label: "University",  icon: <LuBookOpen className="w-5 h-5" />,      panel: "lms" },
  { id: "chat", label: "Chat", icon: <LuMessageSquare className="w-5 h-5" />, panel: "chat" },
  { id: "mom", label: "Meetings", icon: <LuUsersRound className="w-5 h-5" />, panel: "mom" },
  { id: "it", label: "IT Management", icon: <LuMonitor className="w-5 h-5" />, panel: "it" },
  // { id: "hr", label: "HR", icon: <LuMonitor className="w-5 h-5" />, panel: "hr" },
  { id: "chatbot", label: "Dashboard AI", icon: <LuBotMessageSquare className="w-5 h-5" />, panel: "chatbot" },
];

type AccountingNavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const accountingNavItems: AccountingNavItem[] = [
  { label: "Overview",           path: "/accounts",            icon: LuLayoutGrid },
  { label: "Transactions",       path: "/accounts/transactions", icon: LuKanban },
  { label: "Clients",            path: "/accounts/clients",     icon: LuUsers },
  { label: "Employees",          path: "/accounts/employees",  icon: LuBriefcaseBusiness },
  { label: "Vendors",            path: "/accounts/vendors",    icon: LuStore },
  { label: "Accounts & Balances", path: "/accounts/balances",   icon: LuBriefcase },
  { label: "Reports",            path: "/accounts/reports",     icon: LuBookOpen },
];

// ── IT Management nav ────────────────────────────────────────────────────────
type ItNavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const itNavItems: ItNavItem[] = [
  { label: "Dashboard",    path: "/it-management",             icon: LuLayoutGrid },
  { label: "Assets",       path: "/it-management/assets",      icon: LuHardDrive },
  { label: "Employees",    path: "/it-management/employees",   icon: LuUsers },
  { label: "Requests",     path: "/it-management/requests",    icon: LuClipboardList },
  { label: "My Requests",  path: "/it-management/my-requests", icon: LuClipboardCheck },
  { label: "Bills",        path: "/it-management/bills",       icon: LuReceipt },
  // { label: "Settings",  path: "/it-management/settings",    icon: LuSettings },
];

type HrNavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};
// or "lucide-react" — match your existing import source

const HrNavItems: HrNavItem[] = [
  // ---- existing items (kept) ----
  { label: "Dashboard",  path: "/hr-management",             icon: LuLayoutGrid },
  // { label: "Assets",     path: "/hr-management/assets",      icon: LuHardDrive },

  // ---- items from the navbar picture (top → bottom) ----
  { label: "Employees",          path: "/hr-management/employees",         icon: LuUsers },
  { label: "Organization",       path: "/hr-management/organization",     icon: LuBuilding2 },
  { label: "Recruitment",        path: "/hr-management/recruitment",      icon: LuBriefcase },
  { label: "Onboarding",        path: "/hr-management/onboarding",        icon: LuUserPlus },
  { label: "Attendance",         path: "/hr-management/attendance",       icon: LuClock },
  { label: "Leave",              path: "/hr-management/leave",             icon: LuCalendar },
  { label: "Approvals",          path: "/hr-management/approvals",         icon: LuCalendar},
  { label: "Performance",        path: "/hr-management/performance",      icon: LuTarget },
  { label: "Probation",          path: "/hr-management/probation",         icon: LuShieldCheck},
  { label: "Training",           path: "/hr-management/training",          icon: LuGraduationCap },
  { label: "Employee Relations", path: "/hr-management/employee-relations", icon: LuShield },
  { label: "Letters & Docs",     path: "/hr-management/letters-docs",      icon: LuFileText },
  { label: "Movements",          path: "/hr-management/movements",         icon: LuArrowLeftRight },
  { label: "Exit & Clearance",   path: "/hr-management/exit-clearance",   icon: LuLogOut },
  { label: "Reports",            path: "/hr-management/reports",           icon: LuCalendar },
  { label: "Settings",           path: "/hr-management/settings",          icon: LuSettings },
];

// ── Nav link definitions ─────────────────────────────────────────────────────
type NavLink = { label: string; path: string; icon: React.ReactNode; badge?: number };

const inboxLinks: NavLink[] = [
  { label: "Inbox",             path: "/",      icon: <RiInbox2Fill className="w-4 h-4" /> },
  { label: "Replies",           path: "/replies",           icon: <BsReply  className="w-4 h-4" /> },
  { label: "Assigned Comments", path: "/assigned-comments", icon: <BsPersonWorkspace  className="w-4 h-4" /> },
  { label: "My Tasks",          path: "/my-tasks", icon: <BsPersonCheck className="w-4 h-4" /> },
];


type SettingsNavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tab?: string;
};

const workspaceSettingsItems: SettingsNavItem[] = [
  { label: "General",  icon: LuSettings, tab: "general" },
  { label: "People",   icon: LuUsers,    tab: "people" },
];

const mySettingsItems: SettingsNavItem[] = [
  { label: "Preferences", icon: LuSlidersHorizontal, tab: "preferences" },
];

function SidebarListRow({
  project,
  list,
  isActive,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  project: Project;
  list: TaskList;
  isActive: boolean;
  onDragStart: (listId: string) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (targetListId: string) => void;
}) {
  const router = useRouter();
  const { renameList, archiveList, restoreList, deleteList } = useOptionalTaskLists();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renamingInline, setRenamingInline] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const navigateToList = () => {
    router.push(`/projects?projectId=${project.id}&listId=${list.id}&view=list`);
  };

  const startInlineRename = () => {
    setRenameValue(list.name);
    setRenamingInline(true);
    setTimeout(() => renameInputRef.current?.focus(), 30);
  };

  const commitInlineRename = async () => {
    const trimmed = renameValue.trim();
    setRenamingInline(false);
    if (!trimmed || trimmed === list.name) return;
    setIsMutating(true);
    try {
      await renameList(project.id, list.id, { name: trimmed });
      toast.success(`List renamed to "${trimmed}"`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleArchive = async () => {
    setIsMutating(true);
    try {
      await archiveList(project.id, list.id);
      if (isActive) {
        router.push(`/projects?projectId=${project.id}`);
      }
      toast.success(`List "${list.name}" archived`);
      setArchiveOpen(false);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleRestore = async () => {
    setIsMutating(true);
    try {
      await restoreList(project.id, list.id);
      toast.success(`List "${list.name}" restored`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  const handleDelete = async () => {
    setIsMutating(true);
    try {
      await deleteList(project.id, list.id);
      if (isActive) {
        router.push(`/projects?projectId=${project.id}`);
      }
      toast.success(`List "${list.name}" deleted`);
      setDeleteOpen(false);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <>
      <div
        draggable
        onDragStart={() => onDragStart(list.id)}
        onDragOver={onDragOver}
        onDrop={() => onDrop(list.id)}
        className={`group ml-7 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-100"
            : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-905"
        }`}
      >
        <MdChecklist className="h-3.5 w-3.5 shrink-0 text-gray-400" />

        {renamingInline ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitInlineRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitInlineRename();
              if (e.key === "Escape") setRenamingInline(false);
            }}
            className="min-w-0 flex-1 rounded px-1 py-0 text-[13px] bg-white dark:bg-gray-800 border border-brand-500 text-gray-900 dark:text-white outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            type="button"
            onClick={navigateToList}
            className="flex min-w-0 flex-1 items-center text-left"
          >
            <span className="truncate font-normal">{list.name}</span>
            {list.isArchived && <LuArchive className="h-3 w-3 shrink-0 ml-1 text-gray-400" />}
          </button>
        )}

        <button
          ref={menuTriggerRef}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen(true);
          }}
          className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-gray-700 group-hover:opacity-100 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        >
          <LuMoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </div>

      <ListContextMenu
        list={list}
        triggerRef={menuTriggerRef}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onRename={() => { setMenuOpen(false); startInlineRename(); }}
        onArchive={() => setArchiveOpen(true)}
        onRestore={handleRestore}
        onDelete={() => setDeleteOpen(true)}
      />

      <ConfirmActionModal
        isOpen={archiveOpen}
        title="Archive List"
        description={`Archive "${list.name}"? It will disappear from the sidebar until restored from the project view.`}
        confirmLabel="Archive List"
        onClose={() => {
          if (!isMutating) setArchiveOpen(false);
        }}
        onConfirm={handleArchive}
        isLoading={isMutating}
      />

      <ConfirmActionModal
        isOpen={deleteOpen}
        title="Delete List"
        description={`Delete "${list.name}" and all of its tasks? This action cannot be undone.`}
        confirmLabel="Delete List"
        onClose={() => {
          if (!isMutating) setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
        isLoading={isMutating}
      />
    </>
  );
}

// ── Project row with nested list items ────────────────────────────────────────
function SpaceRow({
  project,
  activeProjectId,
  activeListId,
  showArchivedLists = false,
}: {
  project: Project;
  activeProjectId: string | null;
  activeListId: string | null;
  showArchivedLists?: boolean;
}) {
  const router = useRouter();
  const { deleteProject, updateProject, patchLocalProject } = useOptionalProjects();
  const { getProjectLists, reorderLists } = useOptionalTaskLists();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [createListOpen, setCreateListOpen] = useState(false);
  const [draggedListId, setDraggedListId] = useState<string | null>(null);
  const [renamingProject, setRenamingProject] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [sharingOpen, setSharingOpen] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const lists = getProjectLists(project.id, { includeArchived: showArchivedLists });
  const isProjectActive = activeProjectId === project.id && !activeListId;
  const isWithinProject = activeProjectId === project.id;
  const isPrivate = project.visibility === "PRIVATE";

  useEffect(() => {
    if (isWithinProject) setExpanded(true);
  }, [isWithinProject]);

  useEffect(() => {
    if (renamingProject) {
      setTimeout(() => renameInputRef.current?.focus(), 30);
    }
  }, [renamingProject]);

  const openProject = () => {
    router.push(`/projects?projectId=${project.id}`);
  };

  const startRename = () => {
    setRenameValue(project.name);
    setRenamingProject(true);
  };

  const commitProjectRename = async () => {
    const trimmed = renameValue.trim();
    setRenamingProject(false);
    if (!trimmed || trimmed === project.name) return;
    try {
      await updateProject(project.id, { name: trimmed });
      toast.success(`Project renamed to "${trimmed}"`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteProject(project.id);
      toast.success(`Project "${project.name}" deleted`);
      setDeleteOpen(false);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleFavorite = async () => {
    try {
      if (project.isFavorite) {
        await projectService.unfavorite(project.id);
        patchLocalProject(project.id, { isFavorite: false });
      } else {
        await projectService.favorite(project.id);
        patchLocalProject(project.id, { isFavorite: true });
      }
      useUiStore.getState().invalidateFavorites();
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleArchive = async () => {
    try {
      await projectService.archive(project.id);
      patchLocalProject(project.id, { isArchived: true });
      toast.success(`Project "${project.name}" archived`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleRestore = async () => {
    try {
      await projectService.restore(project.id);
      patchLocalProject(project.id, { isArchived: false });
      toast.success(`Project "${project.name}" restored`);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    }
  };

  const handleReorder = async (targetListId: string) => {
    if (!draggedListId || draggedListId === targetListId) return;

    const ids = lists.map((list) => list.id);
    const fromIndex = ids.indexOf(draggedListId);
    const toIndex = ids.indexOf(targetListId);
    if (fromIndex === -1 || toIndex === -1) return;

    const next = [...ids];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);

    try {
      await reorderLists(project.id, next);
    } catch (error) {
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setDraggedListId(null);
    }
  };

  return (
    <>
      <div className="space-y-0.5">
        <div
          className={`group flex w-full items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
            isProjectActive
              ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-100"
              : isWithinProject
                ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-100"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-905"
          }`}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((value) => !value);
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            {expanded ? (
              <LuChevronDown className="h-3.5 w-3.5" />
            ) : (
              <LuChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {renamingProject ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitProjectRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitProjectRename();
                if (e.key === "Escape") setRenamingProject(false);
              }}
              className="min-w-0 flex-1 rounded px-1 py-0 text-[13px] bg-white dark:bg-gray-800 border border-brand-500 text-gray-900 dark:text-white outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              onClick={openProject}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <span
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-white"
                style={{ backgroundColor: project.color }}
              >
                {project.icon && ICON_MAP.has(project.icon)
                  ? (() => { const I = ICON_MAP.get(project.icon!)!; return <I className="h-2.5 w-2.5" />; })()
                  : <span className="text-[10px] font-normal">{project.name?.charAt(0).toUpperCase() ?? ""}</span>
                }
              </span>
              <span className="truncate font-normal text-[13px]">
                {project.name ?? ""}
              </span>
              {/* A glyph rather than the text pill the channels list uses —
                  this row is tight and already truncates. */}
              {isPrivate && (
                <LuLock
                  className="h-3 w-3 shrink-0 text-gray-400"
                  title="Private"
                />
              )}
              {project.isArchived && <LuArchive className="h-3 w-3 shrink-0 text-gray-400" />}
            </button>
          )}

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCreateListOpen(true);
            }}
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 opacity-0 transition-all hover:bg-gray-200 hover:text-brand-500 dark:hover:text-gray-000 group-hover:opacity-100 dark:hover:bg-gray-600/50"
          >
            <LuPlus className="h-3.5 w-3.5" />
          </button>

          <button
            ref={menuTriggerRef}
            onMouseDown={(event) => {
              event.stopPropagation();
              if (!menuOpen) setMenuOpen(true);
            }}
            onClick={(event) => event.stopPropagation()}
            className={`flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-all hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-600/50 dark:hover:text-gray-200 ${menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
          >
            <LuMoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </div>

        {expanded ? (
          <div className="space-y-0.5">
            {lists.map((list) => (
              <SidebarListRow
                key={list.id}
                project={project}
                list={list}
                isActive={activeProjectId === project.id && activeListId === list.id}
                onDragStart={setDraggedListId}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleReorder}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* Context menu — rendered outside the row so it isn't clipped by overflow-hidden */}
      <SpaceContextMenu
        project={project}
        triggerRef={menuTriggerRef}
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onEdit={() => { setMenuOpen(false); setEditOpen(true); }}
        onRename={() => startRename()}
        onDelete={() => {
          setMenuOpen(false);
          setDeleteOpen(true);
        }}
        onIconColorChange={async (icon, color) => {
          try {
            await updateProject(project.id, { icon, color });
          } catch {
            toast.error("Failed to update icon & color");
          }
        }}
        onFavorite={handleFavorite}
        onArchive={handleArchive}
        onRestore={handleRestore}
        onSharing={() => setSharingOpen(true)}
      />

      {/* Edit modal — lives here so it survives after the context menu unmounts */}
      <EditSpaceModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        project={project}
        onManageSharing={() => setSharingOpen(true)}
      />

      {deleteOpen && (
        <ConfirmActionModal
          isOpen={deleteOpen}
          title="Delete Project"
          description={`Delete project "${project.name}"? This action cannot be undone.`}
          confirmLabel="Delete Project"
          onClose={() => {
            if (!deleteLoading) setDeleteOpen(false);
          }}
          onConfirm={handleDelete}
          isLoading={deleteLoading}
        />
      )}

      <CreateListModal
        isOpen={createListOpen}
        onClose={() => setCreateListOpen(false)}
        initialProjectId={project.id}
        lockProject
      />

      {/* Rendered here rather than inside the context menu so it survives that
          menu unmounting on select — same reason EditSpaceModal lives here. */}
      <ProjectMembersModal
        isOpen={sharingOpen}
        onClose={() => setSharingOpen(false)}
        project={project}
      />
    </>
  );
}


// ── Favorites section ────────────────────────────────────────────────────────
function FavoritesSidebarSection() {
  const router = useRouter();
  const { patchLocalProject } = useOptionalProjects();
  const [expanded, setExpanded] = useState(true);
  const {
    favoriteProjects: favProjects,
    favoriteTasks: favTasks,
    removeFavoriteProject,
    removeFavoriteTask,
  } = useFavorites();

  const hasAny = favProjects.length > 0 || favTasks.length > 0;

  if (!hasAny) return null;

  return (
    <div className="mt-1 border-t border-gray-100 pt-4 dark:border-gray-800">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-2 mb-1 group"
      >
        <div className="flex items-center gap-1.5">
          <LuStar className="h-3 w-3 text-amber-400" style={{ fill: "currentColor" }} />
          <p className="text-[11px] uppercase tracking-wide text-gray-400 font-normal">Favorites</p>
        </div>
        {expanded ? (
          <LuChevronDown className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        ) : (
          <LuChevronRight className="h-3 w-3 text-gray-400 opacity-0 group-hover:opacity-100" />
        )}
      </button>

      {expanded && (
        <div className="space-y-0.5">
          {favProjects.map((p) => (
            <div
              key={p.id}
              className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              <button
                type="button"
                onClick={() => router.push(`/projects?projectId=${p.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-white text-[10px]"
                  style={{ backgroundColor: p.color }}
                >
                  {p.icon && ICON_MAP.has(p.icon)
                    ? (() => { const I = ICON_MAP.get(p.icon!)!; return <I className="h-2.5 w-2.5" />; })()
                    : p.name.charAt(0).toUpperCase()
                  }
                </span>
                <span className="truncate">{p.name}</span>
              </button>
              <button
                type="button"
                title="Remove from favorites"
                onClick={async () => {
                  try {
                    await projectService.unfavorite(p.id);
                    removeFavoriteProject(p.id);
                    patchLocalProject(p.id, { isFavorite: false });
                    useUiStore.getState().invalidateFavorites();
                  } catch {
                    toast.error("Failed to remove from favorites");
                  }
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-400 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
              >
                <LuStar className="h-3.5 w-3.5" style={{ fill: "currentColor" }} />
              </button>
            </div>
          ))}
          {favTasks.map((t) => (
            <div
              key={t.id}
              className="group flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              <button
                type="button"
                onClick={() => router.push(`/projects?projectId=${t.list.project.id}&taskId=${t.id}`)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  {t.taskId}
                </span>
                <span className="truncate">{t.title}</span>
              </button>
              <button
                type="button"
                title="Remove from favorites"
                onClick={async () => {
                  try {
                    await taskService.unfavorite(t.id);
                    removeFavoriteTask(t.id);
                    useUiStore.getState().setTaskFavoriteOverride(t.id, false);
                    useUiStore.getState().invalidateFavorites();
                  } catch {
                    toast.error("Failed to remove from favorites");
                  }
                }}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-amber-400 opacity-0 transition-all hover:bg-gray-200 group-hover:opacity-100 dark:hover:bg-gray-700"
              >
                <LuStar className="h-3.5 w-3.5" style={{ fill: "currentColor" }} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Home panel ───────────────────────────────────────────────────────────────
function HomePanelContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [spacesMenuOpen, setSpacesMenuOpen] = useState(false);
  const spacesMenuRef = useRef<HTMLDivElement>(null);
  const spacesMenuBtnRef = useRef<HTMLButtonElement>(null);
  const { projects, isLoading: projectsLoading, fetchArchivedProjects } = useOptionalProjects();
  const { getLists } = useOptionalTaskLists();
  const activeProjectId = searchParams.get("projectId");
  const activeListId = searchParams.get("listId");

  useEffect(() => {
    if (!spacesMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        !spacesMenuRef.current?.contains(e.target as Node) &&
        !spacesMenuBtnRef.current?.contains(e.target as Node)
      ) setSpacesMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [spacesMenuOpen]);

  useEffect(() => {
    projects.forEach((project) => {
      void getLists(project.id).catch(() => {
        // Sidebar can render without lists if the request fails.
      });
    });
  }, [getLists, projects]);

  useEffect(() => {
    if (!showArchived) return;
    projects.forEach((project) => {
      void getLists(project.id, { includeArchived: true }).catch(() => {});
    });
  }, [showArchived, getLists, projects]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-2 py-3 text-[14px]">
      <div className="flex-1 space-y-0.5 overflow-y-auto pb-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-200 dark:[&::-webkit-scrollbar-thumb]:bg-gray-800">

        {/* Home links */}
        <p className="px-2 pb-2 text-[16px] font-semibold text-gray-900 dark:text-gray-100">Board</p>
        {inboxLinks.map((item) => {
          const active = item.path === pathname || (item.path === "/" && pathname === "/");
          return (
            <Link
              key={item.label}
              href={item.path}
              className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors
                ${active
                  ? "bg-gray-200 text-gray-900 dark:bg-gray-905 dark:text-gray-100"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-[#282626]"}`}
            >
              <span className={active ? "text-gray-500 dark:text-gray-100" : "text-gray-400 "}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Favorites */}
        <FavoritesSidebarSection />

        {/* Projects */}
        <div className="mt-3 border-t border-gray-100 pt-5 dark:border-gray-800">
          <div className="relative flex items-center justify-between px-2 mb-1">
            <p className="text-[12px] uppercase tracking-wide text-gray-600 dark:text-gray-400 font-semibold">Projects</p>
            <div className="flex items-center gap-1">
              <button
                ref={spacesMenuBtnRef}
                type="button"
                onClick={() => setSpacesMenuOpen((v) => !v)}
                className="text-gray-400 hover:text-gray-900  dark:hover:text-gray-000 transition-colors"
              >
                <LuMoreHorizontal className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="text-gray-400 hover:text-gray-900 dark:hover:text-gray-000 transition-colors"
              >
                <LuPlus className="w-4 h-4" />
              </button>
            </div>

            {spacesMenuOpen && (
              <div
                ref={spacesMenuRef}
                className="absolute top-6 right-0 z-50 w-52 rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <button
                  type="button"
                  onClick={() => { setCreateOpen(true); setSpacesMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <LuPlus className="h-4 w-4 text-gray-400" />
                  Create Project
                </button>
                <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                <button
                  type="button"
                  onClick={() => {
                    const next = !showArchived;
                    setShowArchived(next);
                    if (next) void fetchArchivedProjects();
                  }}
                  className="flex w-full items-center justify-between gap-2.5 px-3.5 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <div className="flex items-center gap-2.5">
                    <LuArchive className="h-4 w-4 text-gray-400" />
                    Show archived
                  </div>
                  <div className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors ${showArchived ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"}`}>
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${showArchived ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Live projects from backend */}
          {projectsLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : projects.length === 0 ? (
            <p className="px-2.5 py-2 text-[14px] text-gray-400 italic">No projects yet</p>
          ) : (
            <div className="space-y-0.5 mt-0.5">
              {projects
                .filter((p) => showArchived || !p.isArchived)
                .map((project) => (
                  <SpaceRow
                    key={project.id}
                    project={project}
                    activeProjectId={activeProjectId}
                    activeListId={activeListId}
                    showArchivedLists={showArchived}
                  />
                ))}
            </div>
          )}

          {/* New Project button */}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 mt-1 w-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-905 dark:hover:text-gray-000 transition-colors"
          >
            <LuPlus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>

        {/* Docs */}
        <DocsListSidebarSection />

        {/* Channels and Direct Messages moved to the Chat module — they are
            no longer project-scoped, and their sockets now mount app-wide in
            AdminLayoutClient rather than from this sidebar. */}
      </div>

      {/* <div className="border-t border-gray-100 px-1 pt-3 dark:border-gray-800">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-50 px-2 py-2 text-[13px] text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
          <LuSlidersHorizontal className="w-3.5 h-3.5" />
          <span>Customize Sidebar</span>
        </button>
      </div> */}

      {/* Create Project Modal */}
      <CreateSpaceModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function AccountsPanelContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  const { canSeeAllMenus } = useAccountingAccess();

  // CEO and accountant both see every accounting menu — they differ only in the
  // write controls inside each page (gated on `canWrite`). A `null` role never
  // reaches this panel at all.
  const visibleNavItems = canSeeAllMenus
    ? accountingNavItems
    : accountingNavItems.filter((item) => item.path === "/accounts");

  const navItem = (item: AccountingNavItem) => {
    const Icon = item.icon;
    const isActive = item.path === "/accounts" ? pathname === "/accounts" : pathname.startsWith(item.path);
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => router.push(item.path)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-401 font-bold"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905 "
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Accounting
      </h2>

      <div className="pt-2 space-y-0.5">
        {visibleNavItems.map(navItem)}
      </div>

      <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
        <div className="space-y-0.5">
          {/* One entry, not the full tab list — /settings renders its own panel
              with these same tabs, so listing them here duplicated the menu. */}
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905"
          >
            <LuSettings className="h-4 w-4 shrink-0" />
            <span className="truncate">Settings</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <LuLogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function ItManagementPanelContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { logout } = useAuth();
  // This panel only ever renders for someone who can access the full module
  // (OWNER or isItManager) — a plain member goes straight to the full-width
  // My Requests screen instead, with no panel at all (see the "it" +
  // !canAccessItModule suppression in the rail render below, and
  // AdminLayoutClient's matching offset). A manager already tracks every
  // request through the Requests board, so My Requests — a personal
  // self-service tracker — is the one tab dropped here.
  const visibleItNavItems = itNavItems.filter((item) => item.path !== "/it-management/my-requests");

  const navItem = (item: ItNavItem) => {
    const Icon = item.icon;
    const isActive =
      item.path === "/it-management"
        ? pathname === "/it-management"
        : pathname.startsWith(item.path);
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => router.push(item.path)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-401 font-bold"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905 "
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        IT Management
      </h2>

      <div className="pt-2 space-y-0.5">{visibleItNavItems.map(navItem)}</div>

      {/* <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
        <div className="space-y-0.5">
          <button
            type="button"
            onClick={() => router.push("/settings")}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905"
          >
            <LuSettings className="h-4 w-4 shrink-0" />
            <span className="truncate">Settings</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <LuLogOut className="h-4 w-4 shrink-0" />
            <span>Log out</span>
          </button>
        </div>
      </div> */}
    </div>
  );
}


function HrPanelContent() { 
  const router = useRouter();
  const pathname = usePathname();


  const navItem = (item: HrNavItem) => {
    const Icon = item.icon;
    const isActive =
      item.path === "/hr-management"
        ? pathname === "/hr-management"
        : pathname.startsWith(item.path);
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => router.push(item.path)}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-401 font-bold"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905 "
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        HR Management
      </h2>
      <div className="pt-2 space-y-0.5">{HrNavItems.map(navItem)}</div>
    </div>
  );
}


function SettingsPanelContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") ?? "general").toLowerCase();
  const isSettingsRoute = pathname.startsWith("/settings");
  const { logout } = useAuth();
  const { isAccountant } = useAccountingAccess();

  const navigateToTab = (tab: string) => {
    const query = tab === "general" ? "" : `?tab=${tab}`;
    router.push(`/settings${query}`);
  };

  const navItem = (item: SettingsNavItem) => {
    const Icon = item.icon;
    const isActive = isSettingsRoute && !!item.tab && currentTab === item.tab;
    return (
      <button
        key={item.label}
        type="button"
        onClick={() => { if (item.tab) navigateToTab(item.tab); }}
        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
          isActive
            ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-401 font-bold"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905 "
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-2 text-[13px]">
      <h2 className="px-2 py-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
        Settings
      </h2>

      {/* Accountant only: the settings panel replaces their one rail item
          and the icon rail itself is hidden for them, so this is their only
          way back. A scoped IT Manager still has the rail (with its own
          Settings icon) to navigate with, so they don't need an equivalent
          shortcut. */}
      {isAccountant && (
        <button
          type="button"
          onClick={() => router.push("/accounts")}
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-brand-500 transition-colors hover:bg-brand-500/10"
        >
          <LuArrowLeft className="h-4 w-4 shrink-0" />
          <span className="truncate">Back to Dashboard</span>
        </button>
      )}

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          Workspace
        </p>
        <div className="space-y-0.5">
          {workspaceSettingsItems.map(navItem)}
        </div>
      </div>

      <div className="pt-3">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">
          My Settings
        </p>
        {mySettingsItems.map(navItem)}
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-red-500 transition-colors hover:bg-red-50 dark:hover:bg-red-500/10"
        >
          <LuLogOut className="h-4 w-4 shrink-0" />
          <span>Log out</span>
        </button>
      </div>
    </div>
  );
}

const lmsMainItems = [
  { label: "Dashboard",     icon: LuLayoutGrid,  href: "/university",                exact: true },
  { label: "Course Library", icon: LuBookOpen,    href: "/university/course-library", exact: false },
  { label: "My Learning",   icon: LuPlay,        href: "/university/my-learning",    exact: false },
];

function LmsPanelContent() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar px-2 py-3 text-[13px]">
      <p className="px-2 pb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">University</p>

      <div className="space-y-0.5">
        <p className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-400 font-normal">Main</p>
        {lmsMainItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => router.push(item.href)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                isActive
                  ? "bg-gray-100 text-gray-900 dark:bg-gray-905 dark:text-gray-100"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-905 dark:hover:text-gray-100"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}



// ── Panel header — university name for LMS ───────────────────────────────────
function LmsPanelHeader() {
  return (
    <div className="flex items-center px-6 py-[15.5px] border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-1.5">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-violet-600 dark:bg-gray-000 dark:text-black text-white text-[10px] font-normal shrink-0">
          <LuBookOpen className="w-3 h-3" />
        </span>
        <span className="font-normal text-gray-800 dark:text-gray-100 truncate max-w-[180px]">
          Dashboard University
        </span>
      </div>
    </div>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
const AppSidebar: React.FC<{ hasHeader?: boolean }> = ({ hasHeader = true }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isOpeningClientHub, setIsOpeningClientHub] = useState(false);
  const isSettingsRoute = pathname.startsWith("/settings");
  const isLmsRoute = pathname.startsWith("/university");
  const isChatRoute = pathname.startsWith("/chat");
  const isWorkspaceChatRoute = pathname.startsWith("/workspace-chat");
  const isAccountsRoute = pathname.startsWith("/accounts");
  // Departments is no longer its own rail item — for OWNER/MANAGER it's what
  // "Meetings" now opens (see handleRailClick), so both prefixes highlight
  // the same "mom" rail entry.
  const isMomRoute = pathname.startsWith("/meetings") || pathname.startsWith("/departments");
  const isItRoute = pathname.startsWith("/it-management");
  const isHrRoute = pathname.startsWith("/hr");

  // Derived directly from the URL on every render — never stored as its own
  // state. The previous version tracked this in useState (defaulting to
  // "lms") synced by a useEffect that explicitly skipped updating while
  // already on a settings route. Since (university) and (admin) are separate
  // route-group layouts, navigating from University to Settings remounts this
  // component from scratch: activeRail was reborn as "lms" and the effect
  // never got a chance to correct it, so the panel stayed on the University
  // menu even though the page content had already switched to Settings.
  const activeRail = isSettingsRoute
    ? "settings"
    : isLmsRoute
      ? "lms"
      : isWorkspaceChatRoute
        ? "chat"
        : isChatRoute
          ? "chatbot"
          : isMomRoute
            ? "mom"
            : isAccountsRoute
              ? "accounts"
              : isItRoute
                ? "it"
                :isHrRoute
                  ? "hr"
                : "home";
  const isSettingsActive = activeRail === "settings";

  // Accountants are scoped to accounting, so the other rails are hidden from
  // them entirely. Users with no role get no accounting rail at all.
  const { isAccountant, canAccessAccounting } = useAccountingAccess();
  // Inviting is OWNER/MANAGER-only; a plain MEMBER gets no Invite action.
  const { canManageWorkspace } = useWorkspaceManageAccess();
  // Grants MoM access to a MEMBER scoped to their own department — see
  // useMomAccessGuard, which this mirrors.
  const { departmentId: myDepartmentId, isDepartmentSupervisor } = useMyDepartment();
  // The full module (Assets/Employees/Bills/Dashboard/the all-requests board)
  // is OWNER + IT-Manager-only server-side (`ItManagerGuard`) — a generic
  // MANAGER with no `isItManager` flag doesn't qualify either. But every
  // member can track their own requests, so the rail item itself stays
  // visible to everyone (bar accountants); clicking it takes a non-manager
  // straight to My Requests as the main content with no contextual panel
  // beside it (see the panel-suppression condition below), the same way
  // Chat/Meetings already skip the panel. A plain MEMBER who *is* flagged
  // `isItManager`, though, has every OTHER rail item dropped — "IT Manage"
  // is the only one left — unlike an accountant, they still keep the rail
  // itself (just narrowed to this one icon), not just the panel. See
  // `isScopedToItModule`'s own doc comment for why OWNER/MANAGER are exempt
  // from this narrowing.
  const { isScopedToItModule, canAccessItModule } = useItManagerAccess();
  const visibleRailItems = React.useMemo(
    () =>
      railItems.filter((item) => {
        if (isScopedToItModule) return item.id === "it";
        if (item.id === "accounts") return canAccessAccounting;
        /* Meetings is OWNER/MANAGER-or-department-member server-side — every
           route, reads included, 403s for anyone else. Showing the rail
           would advertise a wall, so it is hidden rather than disabled. */
        if (item.id === "mom") {
          return !isAccountant && (canManageWorkspace || myDepartmentId !== null);
        }
        return !isAccountant;
      }),
    [isAccountant, canAccessAccounting, canManageWorkspace, myDepartmentId, isScopedToItModule]
  );

  const handleRailClick = (id: string) => {
    if (id === "home") {
      router.push("/");
      return;
    }
    if (id === "lms") {
      router.push("/university");
      return;
    }
    if (id === "accounts") {
      router.push("/accounts");
      return;
    }
    if (id === "chat") {
      router.push("/workspace-chat");
      return;
    }
    if (id === "mom") {
      // OWNER/MANAGER manage MoM per department, browsing every department
      // from the Departments screen. A department's own supervisor browses
      // that same screen too (read-only, and can only open their own — see
      // useDepartmentsAccessGuard). A plain department member skips the
      // browse screen entirely and goes straight to their own department's
      // page — they can view and take part in its meetings, just not
      // create or delete them (creator-only, and create is manager/
      // supervisor-only — see useMomCreateAccess). myDepartmentId is never
      // null here: this rail item is hidden otherwise (see visibleRailItems).
      if (canManageWorkspace || isDepartmentSupervisor) {
        router.push("/departments");
      } else {
        router.push(`/departments/${myDepartmentId}`);
      }
      return;
    }
    if (id === "it") {
      // A plain member lands straight on My Requests — the dashboard and
      // every other IT tab 403 server-side for them anyway. Pushing here
      // directly skips the extra redirect hop useItModuleMemberRedirect
      // would otherwise do after landing on /it-management.
      router.push(canAccessItModule ? "/it-management" : "/it-management/my-requests");
      return;
    }
    if(id === "hr"){
      router.push("/hr-management");
      return;
    }
    if (id === "chatbot") {
      router.push("/chat");
      return;
    }
  };

  const handleSettingsClick = () => {
    router.push("/settings");
  };

  const handleClientHubClick = async () => {
    if (isOpeningClientHub) return;
    // Open the tab synchronously, inside the trusted click handler — doing
    // this after the await below would get silently blocked by popup
    // blockers in most browsers. Must not pass noopener/noreferrer here:
    // those force window.open to always return null, which would make the
    // popup-blocked check below fire even when the tab opened successfully.
    const odooTab = window.open("", "_blank");
    if (odooTab) {
      odooTab.opener = null;
    }
    setIsOpeningClientHub(true);
    try {
      const { data } = await ssoService.redirectToOdoo();
      if (odooTab) {
        odooTab.location.href = data.redirectUrl;
      } else {
        toast.error("Please allow pop-ups to open Client Hub.");
      }
    } catch (error) {
      odooTab?.close();
      const { message } = parseApiError(error);
      toast.error(message);
    } finally {
      setIsOpeningClientHub(false);
    }
  };

  return (
    <aside className={`fixed left-0 flex z-50 ${hasHeader ? "top-10 h-[calc(100vh-40px)]" : "top-0 h-screen"}`}>
      {/* Left icon rail — hidden for accountants only: they have exactly one
          rail item, so it would be a column of empty space plus actions
          (Invite) that aren't theirs, and Settings stays reachable from the
          accounting panel's own footer link instead. A scoped IT Manager
          keeps the rail (visibleRailItems already narrows it to just the
          "IT Manage" icon below) so Invite/Settings stay in their usual
          place rather than needing an equivalent footer shortcut. */}
      {!isAccountant && (
      <div className="flex flex-col w-[72px] shrink-0 mx-1 mb-2 dark:bg-gray-901 bg-[#000000] rounded-[10px] overflow-hidden">
        <nav className="flex flex-col items-stretch gap-3 flex-1 pt-2 px-1.5">
          {visibleRailItems.map((item) => {
            const isActive = activeRail === item.id && !isSettingsActive;
            return (
              <button
                key={item.id}
                onClick={() => handleRailClick(item.id)}
                title={item.label}
                className={`relative flex flex-col items-center justify-center w-full h-12 px-1 rounded-xl transition-all duration-150
                  ${isActive
                    ? "text-white"
                    : "text-gray-400 hover:bg-white/10 hover:text-white"
                  }`}
                style={isActive ? { background: "linear-gradient(180deg, #FB64B6 0%, #AD46FF 50%, #2B7FFF 100%)" } : undefined}
              >
                {item.icon}
                <span className="text-[9px] mt-1 leading-none w-full text-center truncate">{item.label}</span>
              </button>
            );
          })}
          {/* Client Hub — commented out for now
          <button
            onClick={handleClientHubClick}
            disabled={isOpeningClientHub}
            title="Client Hub"
            className="relative flex flex-col items-center justify-center w-10 h-10 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-150 disabled:opacity-60"
          >
            {isOpeningClientHub ? (
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <LuBriefcase className="w-5 h-5" />
            )}
            <span className="text-[9px] mt-0.5 leading-none">Client Hub</span>
          </button>
          */}
        </nav>

        {/* Bottom rail actions */}
        <div className="flex flex-col items-stretch gap-1 pb-3 px-1.5 border-t border-white/10 pt-2">
          {/* Inviting is OWNER/MANAGER-only server-side (`@Roles('OWNER',
              'MANAGER')`), so a plain MEMBER never sees the entry point. */}
          {canManageWorkspace && (
            <button
              title="Invite"
              onClick={() => setInviteOpen(true)}
              className="flex flex-col items-center justify-center w-full h-12 px-1 rounded-xl text-gray-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <GoPersonAdd className="w-5 h-5" />
              <span className="text-[9px] mt-1 leading-none w-full text-center truncate">Invite</span>
            </button>
          )}
          <button
            title="Settings"
            onClick={handleSettingsClick}
            className={`flex flex-col items-center justify-center w-full h-12 px-1 rounded-xl transition-all duration-150
              ${isSettingsActive
                ? "text-white"
                : "text-gray-400 hover:bg-white/10 hover:text-white"
              }`}
            style={isSettingsActive ? { background: "linear-gradient(180deg, #FB64B6 0%, #AD46FF 50%, #2B7FFF 100%)" } : undefined}
          >
            <LuSettings className="w-5 h-5" />
            <span className="text-[9px] mt-1 leading-none w-full text-center truncate">Settings</span>
          </button>
        </div>
      </div>
      )}

      {/* Right contextual panel.
          Suppressed for Chat: that module renders its own conversation list,
          which *is* the sidebar for it — a second panel listing only "All
          conversations" would duplicate the thing sitting right beside it.
          Also suppressed for IT when the viewer has no module access: their
          only tab in there is My Requests anyway, so clicking the rail icon
          goes straight to that full-width screen instead of a panel that
          would just hold one link. A manager/OWNER still gets the panel,
          since they have several tabs to navigate between. */}
      {activeRail !== "chat" && activeRail !== "mom" && !(activeRail === "it" && !canAccessItModule) && (
      <div
        className={`w-[224px] bg-[#f9f9f9] dark:bg-gray-901 border-r border-b border-t border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden mb-2 ${
          // Without the rail beside it the panel sits flush against the window
          // edge, so the rounded left corners and left border would look wrong.
          // A scoped IT Manager still has the rail, so this stays keyed on
          // isAccountant alone.
          isAccountant ? "" : "border-l rounded-tl-xl rounded-bl-xl"
        }`}
      >
        {activeRail === "lms" && <LmsPanelHeader />}
        {isSettingsActive ? (
          <SettingsPanelContent />
        ) : (
          <>
            {activeRail === "home"    && <HomePanelContent />}
            {activeRail === "lms"     && <LmsPanelContent />}
            {activeRail === "chatbot" && <ChatbotPanelContent />}
            {activeRail === "accounts" && <AccountsPanelContent />}
            {activeRail === "it" && <ItManagementPanelContent />}
            {activeRail === "hr" && <HrPanelContent />}
          </>
        )}
      </div>
      )}

      <InvitePeopleModal
        isOpen={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </aside>
  );
};

export default AppSidebar;
