"use client";

import { useAuth } from "@/context/AuthContext";
import { hasSessionExists } from "@/stores/auth.store";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ProjectProvider } from "@/context/ProjectContext";
import { TaskListProvider } from "@/context/TaskListContext";
import { DocsProvider } from "@/context/DocsContext";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import GlobalTaskDetailModal from "@/components/projects/GlobalTaskDetailModal";
import ChatRealtimeMount from "@/components/chat/ChatRealtimeMount";
import NotificationPermissionBanner from "@/components/ui/NotificationPermissionBanner";
import UserProfilePanel from "@/components/user-profile/UserProfilePanel";
import ViewUserProfilePanel from "@/components/user-profile/ViewUserProfilePanel";
import { useAccountantLockIn } from "@/hooks/useAccountantLockIn";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useItManagerLockIn } from "@/hooks/useItManagerLockIn";
import { useItManagerAccess } from "@/hooks/useItManagerAccess";
import { useItModuleMemberRedirect } from "@/hooks/useItModuleMemberRedirect";
import { useUiStore } from "@/stores/ui.store";
import { usePathname } from "next/navigation";
import React, { useEffect } from "react";

export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspace();
  const { profilePanelOpen, closeProfilePanel, viewingUserId, closeUserPanel } = useUiStore();
  // Accountants only ever see the accounting area — bounce them off Board/Inbox/etc.
  const isLockingIn = useAccountantLockIn();
  const { isAccountant } = useAccountingAccess();
  // Same treatment for a member whose only elevated capability is being an
  // IT Manager — bounce them off everything but /it-management and /settings.
  const isItManagerLockingIn = useItManagerLockIn();
  // The reverse case: a plain member with no IT access at all who lands on
  // one of the module's manager-only routes gets bounced down to
  // /it-management/my-requests instead — the one screen in there open to
  // everyone.
  const isItModuleMemberRedirecting = useItModuleMemberRedirect();
  const { canAccessItModule } = useItManagerAccess();
  /* Chat and Meetings suppress the sidebar's contextual panel — Chat's own
     conversation list takes that role, and Meetings (including the
     Departments screens it now opens for OWNER/MANAGER — see AppSidebar's
     `activeRail`, which maps both under "mom") is a full-width screen — so
     the content offset drops to the rail alone. Same treatment for IT when
     the viewer has no module access: My Requests is their only tab in
     there, so it renders full-width too, same as AppSidebar's own panel
     suppression for "it" in that case. */
  const pathname = usePathname();
  const hidesSidebarPanel =
    pathname.startsWith("/workspace-chat") ||
    pathname.startsWith("/meetings") ||
    pathname.startsWith("/departments") ||
    (pathname.startsWith("/it-management") && !canAccessItModule);
  useEffect(() => {
    // Only bounce to /signin when we are sure the user has never logged in on
    // this browser. If session_exists is set, AuthContext is still trying to
    // restore via /auth/refresh — don't race ahead with a redirect.
    if (!isLoading && !isAuthenticated && !hasSessionExists()) {
      window.location.replace("/signin");
    }
  }, [isLoading, isAuthenticated]);

  if (
    isLoading ||
    (!isAuthenticated && hasSessionExists()) ||
    isLockingIn ||
    isItManagerLockingIn ||
    isItModuleMemberRedirecting
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-gray-900">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  // Accountants live entirely in /accounts, which is not workspace-scoped, so
  // don't trap them in workspace onboarding they have no use for.
  const forcedModal =
    !workspacesLoading && isAuthenticated && workspaces.length === 0 && !isAccountant;

  return (
    // Projects/lists/docs are only used by the dashboard (admin) area, so scope
    // their providers here instead of the root layout — otherwise they'd fetch
    // GET /projects and GET /docs on every route, including the university pages.
    <ProjectProvider>
    <TaskListProvider>
    <DocsProvider>
    <NotificationProvider>
    <div className="flex flex-col h-screen overflow-hidden bg-white dark:bg-gray-907">
      {/* Header — full width, above everything */}
      <NotificationPermissionBanner />
      <AppHeader />

      {/* Body row: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar hasHeader={true} />

        {/* Main area — offset by whatever the sidebar actually renders.
            Sidebar is 72px icon rail (plus its 8px of margins) + 224px panel.
            Accountants don't get the rail, so their offset is the panel
            alone; a scoped IT Manager keeps the rail (just narrowed to one
            icon), so they get the normal full offset; Chat, Meetings, and a
            non-manager on /it-management (My Requests, full-width) don't get
            the panel, so their offset is the rail alone. */}
        <div
          className={`flex flex-col flex-1 min-w-0 overflow-hidden ${
            isAccountant
              ? "ml-[224px]"
              : hidesSidebarPanel
                // 72px rail + its own mx-1 (4px each side) = 80px.
                ? "ml-[80px]"
                : "ml-[296px]"
          }`}
        >
          {/* Content row: main + profile panels side by side */}
          <div className="flex flex-1 overflow-hidden">
            {/* Only the right corners are rounded normally, because the
                sidebar panel supplies the left ones. With that panel hidden
                (Chat), main is the leftmost pane and has to round its own. */}
            <main
              className={`flex-1 border border-r border-b mr-2 mb-2 rounded-tr-lg rounded-br-lg border-gray-200 dark:border-gray-800 overflow-hidden ${
                // rounded-[10px] to match the rail's own corner radius.
                hidesSidebarPanel ? "rounded-tl-[10px] rounded-bl-[10px]" : ""
              }`}
            >
              {children}
            </main>

            {/* Own profile panel — only covers content area */}
            <UserProfilePanel isOpen={profilePanelOpen} onClose={closeProfilePanel} />

            {/* Other user's profile panel — only covers content area */}
            <ViewUserProfilePanel userId={viewingUserId} onClose={closeUserPanel} />
          </div>
        </div>
      </div>

      {/* Chat + presence sockets for the whole admin area. */}
      <ChatRealtimeMount />
      <GlobalTaskDetailModal />
      <CreateWorkspaceModal isOpen={forcedModal} />
    </div>
    </NotificationProvider>
    </DocsProvider>
    </TaskListProvider>
    </ProjectProvider>
  );
}
