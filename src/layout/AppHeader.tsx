"use client";

import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useProfileStore } from "@/hooks/useProfile";
import { useAccountingAccess } from "@/hooks/useAccountingAccess";
import { useUiStore } from "@/stores/ui.store";
import { useWorkspace } from "@/context/WorkspaceContext";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import UserAvatar from "@/components/ui/UserAvatar";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import GlobalTaskSearchModal from "@/components/header/GlobalTaskSearchModal";
import WorkspaceSwitcher from "@/components/workspace/WorkspaceSwitcher";
import CreateWorkspaceModal from "@/components/workspace/CreateWorkspaceModal";
import AddSaleModal from "@/components/accounts/AddSaleModal";
import AccountingSearchModal from "@/components/accounts/AccountingSearchModal";
import { LuChevronDown, LuSquareArrowOutUpRight } from "react-icons/lu";

const AppHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { openProfilePanel } = useUiStore();
  const { profile } = useProfileStore();
  const { activeWorkspace } = useWorkspace();
  const status = profile?.status ?? "OFFLINE";
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const switcherTriggerRef = useRef<HTMLButtonElement>(null);
  const wsName = activeWorkspace?.name ?? "Workspace";
  const wsInitial = wsName.charAt(0).toUpperCase();

  // useProfile() already fetches on mount; no forced refetch needed here.
  const router = useRouter();
  const pathname = usePathname();
  const isAccountsRoute = pathname.startsWith("/accounts");
  // Data entry is accountant-only — a CEO gets a read-only accounting view.
  const { canWrite } = useAccountingAccess();
  const canEnterSales = isAccountsRoute && canWrite;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [addSaleOpen, setAddSaleOpen] = useState(false);
  const [searchAnchor, setSearchAnchor] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd+K focuses search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchAnchor(searchBarRef.current?.getBoundingClientRect() ?? null);
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const avatarColor = user?.avatarColor ?? "#6366f1";
  /* The live profile wins over the session copy: uploading a new picture
     updates the profile immediately, while the auth user is only refreshed
     on sign-in. */
  const avatarUrl = profile?.profilePicture ?? user?.avatarUrl ?? null;

  return (
    <header className="sticky top-0 z-40 flex items-center h-10 bg-white dark:bg-gray-907  border-gray-200 dark:border-gray-800">
      {/* Left: workspace switcher — matches sidebar width (72px rail + 224px panel) */}
      <div className="relative flex items-center w-[296px] shrink-0 ml-1 h-full">
        <button
          ref={switcherTriggerRef}
          onClick={() => setSwitcherOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2 py-1 ml-0 border border-transparent rounded-lg font-bold bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-[#EEEEEE] hover:bg-gray-200 dark:hover:bg-white/10 hover:gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded bg-[#6366f1] dark:bg-gray-000 dark:text-black text-white text-[10px] font-normal shrink-0">
            {wsInitial}
          </span>
          <span className="truncate max-w-[180px] text-sm">{wsName}</span>
          <LuChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </button>
        <WorkspaceSwitcher
          isOpen={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          onCreateWorkspace={() => { setSwitcherOpen(false); setCreateModalOpen(true); }}
          anchorRef={switcherTriggerRef}
        />
        <CreateWorkspaceModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
        />
      </div>

      {/* Center + Right: border-b only on content area (not over sidebar) */}
      <div className="flex flex-1 items-center h-full pr-4">

      {/* Center: search */}
      <div className="flex-1 flex justify-center px-4 ">
        <div ref={searchBarRef} className="group relative w-full max-w-[400px] ">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none group-hover:text-gray-801 dark:group-hover:text-gray-100 transition-colors">
            <svg className="w-4 h-4 " fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            readOnly
            placeholder={isAccountsRoute ? "Search client, transaction, reference..." : "Search"}
            onFocus={() => {
              setSearchAnchor(searchBarRef.current?.getBoundingClientRect() ?? null);
              setSearchOpen(true);
            }}
            onClick={() => {
              setSearchAnchor(searchBarRef.current?.getBoundingClientRect() ?? null);
              setSearchOpen(true);
            }}
            className="w-full h-7 cursor-pointer rounded-full border font-semibold hover:placeholder:text-gray-801 dark:hover:placeholder:text-gray-100 hover:text-gray-801  border-gray-200 hover:shadow-md dark:hover:shadow-gray-801 dark:hover:text-white dark:border-transparent bg-white dark:bg-gray-800 pl-9 pr-20 text-sm text-gray-800 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 transition-colors"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-[1px] transition-all duration-300 group-hover:bg-[linear-gradient(180deg,#FB64B6_0%,#AD46FF_50%,#2B7FFF_100%)]">
  <span className="flex items-center gap-0.5 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-400 dark:border-gray-600 dark:bg-gray-800">
    Ctrl K
  </span>
</div>
          {/* <span className="absolute right-3 top-1/2 font-semibold -translate-y-1/2 flex items-center gap-0.5 text-[11px] text-gray-400  bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600  rounded-full px-2 py-0.5 pointer-events-none">
            Ctrl K
          </span> */}
        </div>
      </div>

      {/* Right: theme toggle + avatar */}
      <div className="relative flex items-center gap-3"  ref={menuRef}>
        {canEnterSales && (
          <button
            type="button"
            onClick={() => setAddSaleOpen(true)}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[linear-gradient(90deg,#6366f1_0%,#7c3aed_100%)] px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <LuSquareArrowOutUpRight className="h-3.5 w-3.5" />
            Daily Entry
          </button>
        )}
        <NotificationDropdown />

        <button
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="flex items-center justify-center w-8 h-8 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          {theme === "dark" ? (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.36-.71.71M6.34 17.66l-.71.71m12.73 0-.71-.71M6.34 6.34l-.71-.71M12 7a5 5 0 1 0 0 10A5 5 0 0 0 12 7z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Avatar — opens dropdown */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="relative flex items-center justify-center w-7 h-7 rounded-full mr-2 hover:ring-2 hover:ring-brand-300 transition-all"
          aria-label="Profile menu"
        >
          <UserAvatar
            name={user?.fullName}
            avatarUrl={avatarUrl}
            size={28}
            color={theme === "dark" ? "#f2f4f7" : avatarColor}
          />
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <div className="absolute right-0 top-11 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 z-50 overflow-y-auto max-h-[calc(100vh-64px)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">

            {/* User header */}
            <div className="group flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
              <div className="relative w-9 h-9 shrink-0">
                <UserAvatar
                  name={user?.fullName}
                  avatarUrl={avatarUrl}
                  size={36}
                  color={avatarColor}
                />
                <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-gray-900 ${status === "ONLINE" ? "bg-green-500" : "bg-gray-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-normal text-gray-800 dark:text-gray-100 truncate">{user?.fullName ?? "User"}</p>
                <p className={`text-xs font-normal ${status === "ONLINE" ? "text-green-500" : "text-gray-400"}`}>
                  {status === "ONLINE" ? "Online" : "Offline"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); openProfilePanel(); }}
                className="invisible group-hover:visible shrink-0 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-normal text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Profile
              </button>
            </div>

            {/* Menu items */}
            <div className="py-1.5 px-1.5 space-y-0.5 border-b border-gray-100 dark:border-gray-800">
              <DropItem icon="settings" label="Settings" onClick={() => { setMenuOpen(false); router.push("/settings"); }} />
            </div>

            {/* Footer */}
            <div className="py-1.5 px-1.5 space-y-0.5">
              <DropItem icon="logout" label="Log out" onClick={() => { setMenuOpen(false); logout(); }} danger />
            </div>
          </div>
        )}
      </div>

      {/* Same trigger, different search: accounting routes search clients and
          transactions; everywhere else keeps the workspace task search. */}
      {isAccountsRoute ? (
        <AccountingSearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          anchorRect={searchAnchor}
        />
      ) : (
        <GlobalTaskSearchModal
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          anchorRect={searchAnchor}
        />
      )}
      {canEnterSales && (
        <AddSaleModal isOpen={addSaleOpen} onClose={() => setAddSaleOpen(false)} />
      )}
      </div>
    </header>
  );
};

type DropItemProps = {
  icon: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
};

function DropItem({ icon, label, onClick, danger }: DropItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
        danger
          ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <span className="w-4 h-4 shrink-0 flex items-center justify-center text-gray-400">
        <DropIcon name={icon} />
      </span>
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}

function DropIcon({ name }: { name: string }) {
  const cls = "w-4 h-4";
  switch (name) {
    case "settings":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
    case "logout":
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>;
    default:
      return <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="4" /></svg>;
  }
}

export default AppHeader;
