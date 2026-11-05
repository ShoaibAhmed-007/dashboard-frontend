"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";

const FREQUENT_KEY = "emoji_frequent";
const MAX_FREQUENT = 18;

type Category = {
  id: string;
  label: string;
  icon: string;
  emojis: string[];
};

const CATEGORIES: Category[] = [
  {
    id: "smileys",
    label: "Smiles & People",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","🥹","😅","🤣","😂","🙂","🙃","🫠","😉","😊","😇",
      "🥰","😍","🤩","😘","😗","😚","😙","🥲","😋","😛","😜","🤪","😝","🤑","🤗",
      "🫡","🤭","🫢","🫣","🤫","🤔","🫤","🤐","🤨","😐","😑","😶","🫥","😶‍🌫️",
      "😏","😒","🙄","😬","😮‍💨","🤥","😌","😔","😪","🤤","😴","😷","🤒","🤕",
      "🤢","🤮","🤧","🥵","🥶","🥴","😵","😵‍💫","🤯","🤠","🥳","🥸","😎","🤓",
      "🧐","😕","🫤","😟","🙁","☹️","😮","😯","😲","😳","🥺","🫣","😦","😧","😨",
      "😰","😥","😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱","😤","😡","😠",
      "🤬","😈","👿","💀","☠️","💩","🤡","👹","👺","👻","👽","👾","🤖",
    ],
  },
  {
    id: "gestures",
    label: "Hand Gestures",
    icon: "👋",
    emojis: [
      "👋","🤚","🖐️","✋","🖖","🫱","🫲","🫳","🫴","👌","🤌","🤏","✌️","🤞","🫰",
      "🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","🫵","👍","👎","✊","👊","🤛",
      "🤜","👏","🙌","🫶","👐","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦿","🦵",
      "🦶","👂","🦻","👃","🧠","🫀","🫁","🦷","🦴","👀","👁️","👅","👄","🫦",
    ],
  },
  {
    id: "animals",
    label: "Animals & Nature",
    icon: "🐶",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐻‍❄️","🐨","🐯","🦁","🐮","🐷","🐸",
      "🐵","🙈","🙉","🙊","🐒","🦆","🐔","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝",
      "🐛","🦋","🐌","🐞","🐜","🪲","🦟","🦗","🕷️","🦂","🐢","🦎","🐍","🦕","🦖",
      "🦕","🐙","🦑","🦐","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🐊","🐅","🐆",
      "🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐄","🐎",
      "🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐕‍🦺","🐈","🐈‍⬛","🪶","🐓",
      "🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🎍","🎋","🍃","🍂","🍁","🍄",
      "🐚","🪸","🌾","💐","🌷","🌹","🥀","🌺","🌸","🌼","🌻","🌞","🌝","🌛","🌜",
    ],
  },
  {
    id: "food",
    label: "Food & Drink",
    icon: "🍕",
    emojis: [
      "🍏","🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍈","🍑","🥭","🍍","🥥",
      "🥝","🍅","🍆","🥑","🥦","🥬","🥒","🌶️","🫑","🧄","🧅","🥔","🍠","🫘","🥜",
      "🌰","🍞","🥐","🥖","🫓","🥨","🥯","🥞","🧇","🧈","🍳","🥚","🧆","🥙","🧆",
      "🌮","🌯","🫔","🥗","🥘","🫕","🍲","🍜","🍝","🍛","🍣","🍱","🥟","🦪","🍤",
      "🍙","🍚","🍘","🍥","🥮","🍢","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩",
      "🍪","🌰","🥜","🍯","🧃","🥤","🧋","☕","🫖","🍵","🧉","🍺","🍻","🥂","🍷",
      "🥃","🍸","🍹","🧊","🥄","🍴","🍽️","🥢","🧂",
    ],
  },
  {
    id: "travel",
    label: "Travel & Places",
    icon: "✈️",
    emojis: [
      "🚗","🚕","🚙","🚌","🚎","🏎️","🚓","🚑","🚒","🚐","🛻","🚚","🚛","🚜","🏍️",
      "🛵","🚲","🛴","🛹","🛼","🚏","🛣️","🛤️","⛽","🚨","🚥","🚦","🛑","🚧","⚓",
      "🛟","⛵","🚤","🛥️","🛳️","⛴️","🚢","✈️","🛩️","🛫","🛬","🪂","💺","🚁","🚟",
      "🚠","🚡","🛰️","🚀","🛸","🪐","🌍","🌎","🌏","🗺️","🧭","🏔️","⛰️","🌋","🗻",
      "🏕️","🏖️","🏜️","🏝️","🏞️","🏟️","🏛️","🏗️","🧱","🏘️","🏚️","🏠","🏡","🏢","🏣",
      "🏤","🏥","🏦","🏨","🏩","🏪","🏫","🏬","🏭","🏯","🏰","💒","🗼","🗽","⛪",
      "🕌","🛕","🕍","⛩️","🕋","⛲","⛺","🌁","🌃","🏙️","🌄","🌅","🌆","🌇","🌉",
    ],
  },
  {
    id: "activities",
    label: "Activities",
    icon: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🪀","🏓","🏸","🏒","🏑",
      "🥍","🏏","🪃","🥅","⛳","🪁","🎣","🤿","🎽","🎿","🛷","🥌","🎯","🪃","🎮",
      "🎲","🎰","🧩","🧸","🪅","🎭","🎨","🖼️","🎪","🎤","🎧","🎼","🎵","🎶","🎷",
      "🪗","🎸","🎹","🎺","🎻","🪕","🥁","🪘","🎙️","🎚️","🎛️","📻","📺","📷","📸",
    ],
  },
  {
    id: "objects",
    label: "Objects",
    icon: "💡",
    emojis: [
      "⌚","📱","📲","💻","⌨️","🖥️","🖨️","🖱️","🖲️","💽","💾","💿","📀","🧮","📞",
      "☎️","📟","📠","📺","📻","🧭","⏱️","⏲️","⏰","🕰️","⌛","⏳","📡","🔋","🪫",
      "🔌","💡","🔦","🕯️","🪔","🧯","🛢️","💸","💵","💴","💶","💷","🪙","💰","💳",
      "💎","⚖️","🪜","🧰","🔧","🪛","🔩","⚙️","🗜️","🔗","⛓️","🪝","🧲","🔫","💣",
      "🧨","🪓","🔪","🗡️","⚔️","🛡️","🚬","⚰️","🪦","⚱️","🏺","🔮","📿","🧿","🪬",
      "💈","⚗️","🔭","🔬","🕳️","🩹","🩺","💊","💉","🩸","🧬","🦠","🧫","🧪","🌡️",
      "🛁","🚿","🪥","🪒","🧴","🧷","🧹","🧺","🧻","🪣","🧼","🫧","🪤","🪣","🗑️",
      "🚪","🪞","🪟","🛏️","🛋️","🪑","🚽","🪠","🚰","🛒","🎁","🎀","🎊","🎉","🎈",
      "📦","📫","📪","📬","📭","📮","📯","📜","📃","📄","📑","🗒️","🗓️","📆","📅",
      "📇","📈","📉","📊","📋","📌","📍","📎","🖇️","📏","📐","✂️","🗃️","🗄️","🗑️",
    ],
  },
  {
    id: "symbols",
    label: "Symbols",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❤️‍🔥","❤️‍🩹","❣️","💕","💞",
      "💓","💗","💖","💘","💝","💟","☮️","✝️","☪️","🕉️","☸️","✡️","🔯","🕎","☯️",
      "☦️","🛐","⛎","♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓","🆔",
      "⚛️","🉑","☢️","☣️","📴","📳","🈶","🈚","🈸","🈺","🈷️","✴️","🆚","💮","🉐",
      "㊙️","㊗️","🈴","🈵","🈹","🈲","🅰️","🅱️","🆎","🆑","🅾️","🆘","❌","⭕","🛑",
      "⛔","📛","🚫","💯","💢","♨️","🚷","🚯","🚳","🚱","🔞","📵","🔕","🔇","📶",
      "🔅","🔆","📳","📴","🔱","⚜️","🔰","♻️","✅","🈯","💹","❇️","✳️","❎","🌐",
      "💠","Ⓜ️","🌀","💤","🏧","🚾","♿","🅿️","🛗","🈳","🈂️","🛂","🛃","🛄","🛅",
      "🚹","🚺","🚼","⚧️","🚻","🚮","🎦","📵","🔞","🔃","🔄","🔙","🔛","🔝","🔜",
      "⏫","⬆️","🔼","⏩","⏭️","⏯️","🔀","🔁","🔂","⬅️","⬇️","➡️","⏬","⏪","◀️",
      "▶️","🔵","🟤","⚫","⚪","🟣","🔴","🟠","🟡","🟢","🔷","🔹","🔶","🔸","🔺",
      "🔻","💠","🔘","🔳","🔲","▪️","▫️","◾","◽","◼️","◻️","⬛","⬜","🟥","🟧",
    ],
  },
  {
    id: "flags",
    label: "Flags",
    icon: "🏳️",
    emojis: [
      "🏳️","🏴","🏴‍☠️","🚩","🎌","🏁","🏳️‍🌈","🏳️‍⚧️",
      "🇺🇸","🇬🇧","🇨🇦","🇦🇺","🇩🇪","🇫🇷","🇮🇹","🇯🇵","🇰🇷","🇧🇷","🇮🇳","🇨🇳",
      "🇷🇺","🇪🇸","🇲🇽","🇦🇷","🇿🇦","🇳🇬","🇪🇬","🇸🇦","🇦🇪","🇹🇷","🇵🇰","🇧🇩",
      "🇮🇩","🇵🇭","🇻🇳","🇹🇭","🇲🇾","🇸🇬","🇳🇱","🇧🇪","🇨🇭","🇦🇹","🇸🇪","🇳🇴",
      "🇩🇰","🇫🇮","🇵🇱","🇨🇿","🇭🇺","🇷🇴","🇬🇷","🇵🇹","🇮🇷","🇮🇶","🇮🇱","🇺🇦",
    ],
  },
];

const CATEGORY_ICONS: Record<string, string> = {
  frequent: "🕐",
  smileys: "😀",
  gestures: "👋",
  animals: "🐶",
  food: "🍕",
  travel: "✈️",
  activities: "⚽",
  objects: "💡",
  symbols: "❤️",
  flags: "🏳️",
};

function getFrequent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FREQUENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function recordFrequent(emoji: string) {
  try {
    const prev = getFrequent();
    const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, MAX_FREQUENT);
    localStorage.setItem(FREQUENT_KEY, JSON.stringify(next));
  } catch {}
}

interface Props {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("frequent");
  const [frequent, setFrequent] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFrequent(getFrequent());
    searchRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const handleSelect = (emoji: string) => {
    recordFrequent(emoji);
    setFrequent(getFrequent());
    onSelect(emoji);
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
      e.includes(search)
    ).slice(0, 60);
  }, [search]);

  const allCategories = useMemo(() => {
    const cats = [...CATEGORIES];
    if (frequent.length > 0) {
      return [{ id: "frequent", label: "Frequently Used", icon: "🕐", emojis: frequent }, ...cats];
    }
    return cats;
  }, [frequent]);

  const displayCategories = search.trim()
    ? [{ id: "search", label: `Results for "${search}"`, icon: "🔍", emojis: searchResults }]
    : allCategories;

  const activeRef = useRef<HTMLDivElement>(null);

  const scrollToCategory = (id: string) => {
    setActiveCategory(id);
    setSearch("");
    const el = document.getElementById(`emoji-cat-${id}`);
    el?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-[340px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
      style={{ maxHeight: "380px" }}
    >
      {/* Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <input
          ref={searchRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setActiveCategory("search"); }}
          placeholder="Search..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {/* Emoji grid — scrollable */}
      <div className="flex-1 overflow-y-auto px-3 pb-2 min-h-0">
        {displayCategories.map((cat) => (
          cat.emojis.length === 0 ? null :
          <div key={cat.id} id={`emoji-cat-${cat.id}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 pt-2 pb-1.5 sticky top-0 bg-white dark:bg-gray-900">
              {cat.label}
            </p>
            <div className="grid grid-cols-9 gap-0.5">
              {cat.emojis.map((emoji, i) => (
                <button
                  key={`${emoji}-${i}`}
                  type="button"
                  onClick={() => handleSelect(emoji)}
                  className="flex items-center justify-center w-8 h-8 text-xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
        {search.trim() && searchResults.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No results</p>
        )}
      </div>

      {/* Category tabs */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-2 py-1.5 flex items-center gap-0.5 shrink-0 overflow-x-auto">
        {[{ id: "frequent", icon: "🕐" }, ...CATEGORIES].map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => scrollToCategory(cat.id)}
            className={`flex items-center justify-center w-8 h-8 text-base rounded-lg flex-shrink-0 transition-colors ${
              activeCategory === cat.id
                ? "bg-brand-50 dark:bg-brand-900/30 text-brand-500"
                : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            title={CATEGORY_ICONS[cat.id] ?? cat.id}
          >
            {cat.icon}
          </button>
        ))}
      </div>
    </div>
  );
}
