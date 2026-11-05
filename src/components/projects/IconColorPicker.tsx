"use client";

import { useState, useMemo } from "react";
import { LuSearch } from "react-icons/lu";
import {
  BiSolidFolder,
  BiSolidStar,
  BiSolidHeart,
  BiSolidBolt,
  BiSolidFlame,
  BiSolidLeaf,
  BiSolidSun,
  BiSolidMoon,
  BiSolidCloud,
  BiSolidDroplet,
  BiSolidCompass,
  BiSolidFlag,
  BiSolidHome,
  BiSolidBuilding,
  BiSolidBriefcase,
  BiSolidUser,
  BiSolidShield,
  BiSolidLock,
  BiSolidKey,
  BiSolidBell,
  BiSolidMessage,
  BiSolidPhone,
  BiSolidCalendar,
  BiSolidTimer,
  BiSolidAlarm,
  BiSolidAward,
  BiSolidGift,
  BiSolidTrophy,
  BiSolidMedal,
  BiSolidCheckCircle,
  BiSolidBookOpen,
  BiSolidBook,
  BiSolidNote,
  BiSolidPencil,
  BiSolidPen,
  BiSolidTerminal,
  BiSolidData,
  BiSolidServer,
  BiSolidNetworkChart,
  BiSolidMicrochip,
  BiSolidCamera,
  BiSolidImage,
  BiSolidVideo,
  BiSolidMusic,
  BiSolidMicrophone,
  BiSolidSpeaker,
  BiSolidRadio,
  BiSolidTv,
  BiSolidGame,
  BiSolidCart,
  BiSolidShoppingBag,
  BiSolidCreditCard,
  BiSolidWallet,
  BiSolidChart,
  BiSolidBarChartAlt2,
  BiSolidPieChart,
  BiSolidDoughnutChart,
  BiSolidRocket,
  BiSolidPlane,
  BiSolidCar,
  BiSolidTruck,
  BiSolidShip,
  BiSolidTrain,
  BiSolidBus,
  BiSolidPackage,
  BiSolidBox,
  BiSolidLayer,
  BiSolidLayout,
  BiSolidGrid,
  BiSolidFilterAlt,
  BiSolidWrench,
  BiSolidBrush,
  BiSolidPalette,
  BiSolidPaint,
  BiSolidZap,
  BiSolidFlask,
  BiSolidDiamond,
  BiSolidCrown,
  BiSolidTree,
  BiSolidDog,
  BiSolidCat,
  BiSolidBug,
  BiSolidPizza,
  BiSolidCoffee,
  BiSolidCake,
  BiSolidMap,
  BiSolidParty,
  BiSolidNotepad,
  BiSolidDice1,
  BiSolidHourglass,
  BiSolidPlanet,
} from "react-icons/bi";

export const ICON_OPTIONS: { name: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { name: "BiSolidFolder", icon: BiSolidFolder },
  { name: "BiSolidStar", icon: BiSolidStar },
  { name: "BiSolidHeart", icon: BiSolidHeart },
  { name: "BiSolidBolt", icon: BiSolidBolt },
  { name: "BiSolidFlame", icon: BiSolidFlame },
  { name: "BiSolidLeaf", icon: BiSolidLeaf },
  { name: "BiSolidSun", icon: BiSolidSun },
  { name: "BiSolidMoon", icon: BiSolidMoon },
  { name: "BiSolidCloud", icon: BiSolidCloud },
  { name: "BiSolidDroplet", icon: BiSolidDroplet },
  { name: "BiSolidCompass", icon: BiSolidCompass },
  { name: "BiSolidFlag", icon: BiSolidFlag },
  { name: "BiSolidHome", icon: BiSolidHome },
  { name: "BiSolidBuilding", icon: BiSolidBuilding },
  { name: "BiSolidBriefcase", icon: BiSolidBriefcase },
  { name: "BiSolidUser", icon: BiSolidUser },
  { name: "BiSolidShield", icon: BiSolidShield },
  { name: "BiSolidLock", icon: BiSolidLock },
  { name: "BiSolidKey", icon: BiSolidKey },
  { name: "BiSolidBell", icon: BiSolidBell },
  { name: "BiSolidMessage", icon: BiSolidMessage },
  { name: "BiSolidPhone", icon: BiSolidPhone },
  { name: "BiSolidCalendar", icon: BiSolidCalendar },
  { name: "BiSolidTimer", icon: BiSolidTimer },
  { name: "BiSolidAlarm", icon: BiSolidAlarm },
  { name: "BiSolidAward", icon: BiSolidAward },
  { name: "BiSolidGift", icon: BiSolidGift },
  { name: "BiSolidTrophy", icon: BiSolidTrophy },
  { name: "BiSolidMedal", icon: BiSolidMedal },
  { name: "BiSolidCheckCircle", icon: BiSolidCheckCircle },
  { name: "BiSolidBookOpen", icon: BiSolidBookOpen },
  { name: "BiSolidBook", icon: BiSolidBook },
  { name: "BiSolidNote", icon: BiSolidNote },
  { name: "BiSolidNotepad", icon: BiSolidNotepad },
  { name: "BiSolidPencil", icon: BiSolidPencil },
  { name: "BiSolidPen", icon: BiSolidPen },
  { name: "BiSolidTerminal", icon: BiSolidTerminal },
  { name: "BiSolidData", icon: BiSolidData },
  { name: "BiSolidServer", icon: BiSolidServer },
  { name: "BiSolidNetworkChart", icon: BiSolidNetworkChart },
  { name: "BiSolidMicrochip", icon: BiSolidMicrochip },
  { name: "BiSolidCamera", icon: BiSolidCamera },
  { name: "BiSolidImage", icon: BiSolidImage },
  { name: "BiSolidVideo", icon: BiSolidVideo },
  { name: "BiSolidMusic", icon: BiSolidMusic },
  { name: "BiSolidMicrophone", icon: BiSolidMicrophone },
  { name: "BiSolidSpeaker", icon: BiSolidSpeaker },
  { name: "BiSolidRadio", icon: BiSolidRadio },
  { name: "BiSolidTv", icon: BiSolidTv },
  { name: "BiSolidGame", icon: BiSolidGame },
  { name: "BiSolidCart", icon: BiSolidCart },
  { name: "BiSolidShoppingBag", icon: BiSolidShoppingBag },
  { name: "BiSolidCreditCard", icon: BiSolidCreditCard },
  { name: "BiSolidWallet", icon: BiSolidWallet },
  { name: "BiSolidChart", icon: BiSolidChart },
  { name: "BiSolidBarChartAlt2", icon: BiSolidBarChartAlt2 },
  { name: "BiSolidPieChart", icon: BiSolidPieChart },
  { name: "BiSolidDoughnutChart", icon: BiSolidDoughnutChart },
  { name: "BiSolidRocket", icon: BiSolidRocket },
  { name: "BiSolidPlane", icon: BiSolidPlane },
  { name: "BiSolidCar", icon: BiSolidCar },
  { name: "BiSolidTruck", icon: BiSolidTruck },
  { name: "BiSolidShip", icon: BiSolidShip },
  { name: "BiSolidTrain", icon: BiSolidTrain },
  { name: "BiSolidBus", icon: BiSolidBus },
  { name: "BiSolidPackage", icon: BiSolidPackage },
  { name: "BiSolidBox", icon: BiSolidBox },
  { name: "BiSolidLayer", icon: BiSolidLayer },
  { name: "BiSolidLayout", icon: BiSolidLayout },
  { name: "BiSolidGrid", icon: BiSolidGrid },
  { name: "BiSolidFilterAlt", icon: BiSolidFilterAlt },
  { name: "BiSolidWrench", icon: BiSolidWrench },
  { name: "BiSolidBrush", icon: BiSolidBrush },
  { name: "BiSolidPalette", icon: BiSolidPalette },
  { name: "BiSolidPaint", icon: BiSolidPaint },
  { name: "BiSolidZap", icon: BiSolidZap },
  { name: "BiSolidFlask", icon: BiSolidFlask },
  { name: "BiSolidDiamond", icon: BiSolidDiamond },
  { name: "BiSolidCrown", icon: BiSolidCrown },
  { name: "BiSolidTree", icon: BiSolidTree },
  { name: "BiSolidDog", icon: BiSolidDog },
  { name: "BiSolidCat", icon: BiSolidCat },
  { name: "BiSolidBug", icon: BiSolidBug },
  { name: "BiSolidPizza", icon: BiSolidPizza },
  { name: "BiSolidCoffee", icon: BiSolidCoffee },
  { name: "BiSolidCake", icon: BiSolidCake },
  { name: "BiSolidMap", icon: BiSolidMap },
  { name: "BiSolidParty", icon: BiSolidParty },
  { name: "BiSolidDice1", icon: BiSolidDice1 },
  { name: "BiSolidHourglass", icon: BiSolidHourglass },
  { name: "BiSolidPlanet", icon: BiSolidPlanet },
];

/** Lookup map: icon name → component. Used by SpaceRow to render stored icon name. */
export const ICON_MAP = new Map(ICON_OPTIONS.map((o) => [o.name, o.icon]));

const COLOR_OPTIONS = [
  "#6366f1", "#3b82f6", "#06b6d4", "#14b8a6", "#22c55e",
  "#eab308", "#f97316", "#ef4444", "#ec4899", "#8b5cf6",
  "#a16207", "#64748b", "#0ea5e9", "#10b981", "#f43f5e",
  "#7c3aed", "#d97706", "#059669", "#dc2626", "#2563eb",
];

interface Props {
  selectedIcon: string | null;
  selectedColor: string;
  onIconChange: (icon: string | null) => void;
  onColorChange: (color: string) => void;
}

export default function IconColorPicker({ selectedIcon, selectedColor, onIconChange, onColorChange }: Props) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"icon" | "color">("icon");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().replace(/^bisolid/, "");
    if (!q) return ICON_OPTIONS;
    return ICON_OPTIONS.filter((o) =>
      o.name.toLowerCase().replace(/^bisolid/, "").includes(q)
    );
  }, [search]);

  return (
    <div className="w-72 rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      {/* Tabs */}
      <div className="flex border-b border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setTab("icon")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "icon"
              ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Icons
        </button>
        <button
          type="button"
          onClick={() => setTab("color")}
          className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
            tab === "color"
              ? "border-b-2 border-brand-500 text-brand-600 dark:text-brand-400"
              : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          }`}
        >
          Color
        </button>
      </div>

      {tab === "icon" ? (
        <div>
          {/* Search */}
          <div className="px-3 pt-2.5 pb-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 dark:border-gray-700 dark:bg-gray-800">
              <LuSearch className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <input
                type="text"
                placeholder="Search icons…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-gray-700 outline-none placeholder:text-gray-400 dark:text-gray-200"
              />
            </div>
          </div>

          {/* Clear icon option */}
          {selectedIcon && (
            <div className="px-3 pb-1">
              <button
                type="button"
                onClick={() => onIconChange(null)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                Clear icon (use initials)
              </button>
            </div>
          )}

          {/* Icon grid */}
          <div className="h-56 overflow-y-auto px-3 pb-3">
            <div className="grid grid-cols-8 gap-1">
              {filtered.map((opt) => {
                const Icon = opt.icon;
                const isSelected = selectedIcon === opt.name;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    title={opt.name.replace(/^BiSolid/, "")}
                    onClick={() => onIconChange(opt.name)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                      isSelected
                        ? "bg-brand-100 text-brand-600 dark:bg-brand-900/60 dark:text-brand-300"
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-8 py-6 text-center text-xs text-gray-400">
                  No icons found
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <p className="mb-2.5 text-xs text-gray-500 dark:text-gray-400">Select a color</p>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className="relative flex h-9 w-9 items-center justify-center rounded-xl transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
              >
                {selectedColor === c && (
                  <span className="h-2.5 w-2.5 rounded-full bg-white shadow" />
                )}
              </button>
            ))}
          </div>

          {/* Custom hex input */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-7 w-7 shrink-0 rounded-lg border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: selectedColor }}
            />
            <input
              type="text"
              value={selectedColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9a-fA-F]{0,6}$/.test(val)) onColorChange(val);
              }}
              maxLength={7}
              placeholder="#6366f1"
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          </div>
        </div>
      )}
    </div>
  );
}
