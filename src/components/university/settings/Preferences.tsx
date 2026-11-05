"use client";

import { useState } from "react";
import { toast } from "sonner";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-[#7C3AED]" : "bg-gray-200 dark:bg-gray-600"}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

const SPEEDS = ["0.75x", "1x", "1.25x", "1.5x", "2x"];
const SUBTITLE_LANGS = ["English (default)", "French", "German", "Spanish", "Arabic", "Urdu"];
const UI_LANGS = ["English", "French", "German", "Spanish"];

export default function Preferences() {
  const [speed, setSpeed] = useState("0.75x");
  const [subLang, setSubLang] = useState("English (default)");
  const [uiLang, setUiLang] = useState("English");
  const [autoPlay, setAutoPlay] = useState(true);
  const [subtitles, setSubtitles] = useState(false);
  const [gamification, setGamification] = useState(true);

  const save = () => toast.success("Learning preferences saved.");

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 pb-5 border-b border-gray-100 dark:border-gray-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/10">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 2.5A7.5 7.5 0 1 0 17.5 10" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M10 6v4l3 3" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Learning Preferences</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Personalise your learning experience</p>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Default playback speed</p>
        <div className="flex gap-2 flex-wrap">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                speed === s
                  ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                  : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#7C3AED] hover:text-[#7C3AED]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Subtitle language</label>
          <select
            value={subLang}
            onChange={(e) => setSubLang(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          >
            {SUBTITLE_LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Interface language</label>
          <select
            value={uiLang}
            onChange={(e) => setUiLang(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/30 focus:border-[#7C3AED]"
          >
            {UI_LANGS.map((l) => <option key={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-6 divide-y divide-gray-100 dark:divide-gray-700">
        {[
          {
            label: "Auto-play next lesson",
            sub: "Automatically start the next lesson when one finishes",
            value: autoPlay,
            set: () => setAutoPlay(!autoPlay),
          },
          {
            label: "Show subtitles by default",
            sub: "Turn on captions automatically when a lesson starts",
            value: subtitles,
            set: () => setSubtitles(!subtitles),
          },
          {
            label: "Gamification features",
            sub: "Show points, badges, and leaderboard on your dashboard",
            value: gamification,
            set: () => setGamification(!gamification),
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.sub}</p>
            </div>
            <Toggle enabled={item.value} onChange={item.set} />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          className="rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#6d28d9] transition-colors"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
