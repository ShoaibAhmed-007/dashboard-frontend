"use client";

import {
  BookOpenIcon,
  LayoutGridIcon,
  PlayCircleIcon,
  SettingsIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

const mainItems = [
  {
    label: "Dashboard",
    icon: LayoutGridIcon,
    href: "/university",
    exact: true,
  },
  {
    label: "Course Library",
    icon: BookOpenIcon,
    href: "/university/course-library",
  },
  {
    label: "My Learning",
    icon: PlayCircleIcon,
    href: "/university/my-learning",
  },
];

const manageItems = [
  {
    label: "Settings",
    icon: SettingsIcon,
    href: "/university/settings",
  },
];

export default function UniversitySidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "AR";

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex h-full min-h-screen w-full max-w-[250px] flex-col bg-[#0a0a0a] px-4 py-4 text-white">
      <div>
        <header className="pb-8">
          <div className="relative h-[40px] w-[172px] bg-[url(https://c.animaapp.com/mpxu0wtr4V27Cq/img/group-77.png)] bg-contain bg-left-top bg-no-repeat">
            <div className="absolute left-[113px] top-[30px] text-right text-[9.5px] font-normal leading-none tracking-[0] whitespace-nowrap text-[#f5f7fa] font-['Inter',Helvetica]">
              UNIVERSITY
            </div>
          </div>
        </header>
        <nav aria-label="Sidebar navigation" className="space-y-6">
          <section>
            <div className="px-3 pb-2">
              <h2 className="font-['Inter',Helvetica] text-[11.2px] font-normal leading-none tracking-[0.56px] text-gray-400">
                MAIN
              </h2>
            </div>
            <ul className="space-y-1">
              {mainItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <li key={item.label}>
                    <Link href={item.href}>
                      <Button
                        type="button"
                        variant="ghost"
                        className={`h-auto w-full justify-start rounded-lg px-3 py-2.5 ${
                          isActive
                            ? "border-l-[3px] border-violet-500 bg-[#2f2a5c] text-white hover:bg-[#2f2a5c] hover:text-white"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <span className="flex w-full items-center gap-3">
                          <span className="flex w-5 shrink-0 items-center justify-center">
                            <Icon className="h-[17.6px] w-[17.6px]" />
                          </span>
                          <span className="font-['Inter',Helvetica] text-[14.4px] font-medium leading-none tracking-[0]">
                            {item.label}
                          </span>
                          {/* {item.badge ? (
                            <span className="ml-auto">
                              <Badge className="rounded-xl bg-violet-500 px-2 py-0.5 font-['Inter',Helvetica] text-[11.2px] font-medium leading-none text-white hover:bg-violet-500">
                                {item.badge}
                              </Badge>
                            </span>
                          ) : null} */}
                        </span>
                      </Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
          <section>
            <div className="px-3 pb-2">
              <h2 className="font-['Inter',Helvetica] text-[11.2px] font-normal leading-none tracking-[0.56px] text-gray-400">
                MANAGE
              </h2>
            </div>
            <ul className="space-y-1 pt-2">
              {manageItems.map((item) => {
                const Icon = item.icon;

                return (
                  <li key={item.label}>
                    <Link href={item.href}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto w-full justify-start rounded-lg px-3 py-2.5 text-slate-300 hover:bg-white/5 hover:text-white"
                      >
                        <span className="flex w-full items-center gap-3">
                          <span className="flex w-5 shrink-0 items-center justify-center">
                            <Icon className="h-[17.6px] w-[17.6px]" />
                          </span>
                          <span className="font-['Inter',Helvetica] text-[14.4px] font-medium leading-none tracking-[0]">
                            {item.label}
                          </span>
                        </span>
                      </Button>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </nav>
      </div>
      <div className="mt-auto pt-6">
        <div className="flex items-center rounded-xl bg-white/5 p-3">
          <Avatar className="mr-3 h-9 w-9 rounded-full bg-violet-500">
            <AvatarFallback className="rounded-full bg-violet-500 text-center font-['Inter',Helvetica] text-[12.8px] font-normal text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-['Inter',Helvetica] text-[13.6px] font-normal leading-none tracking-[0] text-white">
              {user?.fullName ?? "User"}
            </p>
            <p className="pt-1 font-['Inter',Helvetica] text-xs font-normal leading-none tracking-[0] text-gray-400">
              {user?.email ?? ""}
            </p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="ml-auto text-gray-400 hover:text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M11 11l3-3-3-3M14 8H6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
