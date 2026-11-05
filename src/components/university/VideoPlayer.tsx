"use client";

import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";

interface VideoPlayerProps {
  manifestUrl: string;
  lastPositionSeconds: number;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onPause: (currentTime: number, duration: number) => void;
  onSeeked: (currentTime: number, duration: number) => void;
  onEnded: (duration: number) => void;
}

interface QualityLevel {
  index: number;
  label: string;
  height: number;
  enabled: boolean;
}

function toProxiedUrl(manifestUrl: string): string {
  return `/api/hls-proxy?url=${encodeURIComponent(manifestUrl)}`;
}

export default function VideoPlayer({
  manifestUrl,
  lastPositionSeconds,
  onTimeUpdate,
  onPause,
  onSeeked,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number | "auto">("auto");
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;

    const proxiedSrc = toProxiedUrl(manifestUrl);

    const videoEl = document.createElement("video-js");
    videoEl.classList.add("vjs-big-play-centered", "vjs-fluid");
    videoRef.current.appendChild(videoEl);

    const player = videojs(videoEl, {
      autoplay: false,
      controls: true,
      responsive: true,
      fluid: true,
      preload: "auto",
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      sources: [{ src: proxiedSrc, type: "application/x-mpegURL" }],
    });

    playerRef.current = player;

    player.on("loadedmetadata", () => {
      if (lastPositionSeconds > 0) {
        player.currentTime(lastPositionSeconds);
      }

      // Build quality levels list from VHS qualityLevels API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ql = (player as any).qualityLevels?.();
      if (ql) {
        const buildLevels = () => {
          const levels: QualityLevel[] = [];
          for (let i = 0; i < ql.length; i++) {
            const level = ql[i];
            if (level.height) {
              levels.push({ index: i, label: `${level.height}p`, height: level.height, enabled: level.enabled });
            }
          }
          // Sort descending by height, deduplicate labels
          const seen = new Set<string>();
          const unique = levels
            .sort((a, b) => b.height - a.height)
            .filter((l) => { if (seen.has(l.label)) return false; seen.add(l.label); return true; });
          setQualityLevels(unique);
        };

        ql.on("addqualitylevel", buildLevels);
        buildLevels();
      }
    });

    player.on("timeupdate", () => {
      const ct = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      onTimeUpdate(ct, dur);
    });

    player.on("pause", () => {
      const ct = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      onPause(ct, dur);
    });

    player.on("seeked", () => {
      const ct = player.currentTime() ?? 0;
      const dur = player.duration() ?? 0;
      onSeeked(ct, dur);
    });

    player.on("ended", () => {
      const dur = player.duration() ?? 0;
      onEnded(dur);
    });

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
      setQualityLevels([]);
      setSelectedQuality("auto");
      setShowQualityMenu(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestUrl]);

  const applyQuality = (value: number | "auto") => {
    setSelectedQuality(value);
    setShowQualityMenu(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ql = (playerRef.current as any)?.qualityLevels?.();
    if (!ql) return;

    for (let i = 0; i < ql.length; i++) {
      if (value === "auto") {
        ql[i].enabled = true;
      } else {
        // Enable only the levels matching the selected height
        ql[i].enabled = qualityLevels.find((l) => l.index === i)?.height === qualityLevels.find((l) => l.index === value)?.height;
      }
    }
    // Trigger VHS to re-evaluate
    ql.trigger("change");
  };

  const currentLabel = selectedQuality === "auto"
    ? "Auto"
    : qualityLevels.find((l) => l.index === selectedQuality)?.label ?? "Auto";

  return (
    <div className="rounded-xl overflow-hidden bg-[#1a1a2e] shadow-lg relative">
      <div data-vjs-player>
        <div ref={videoRef} />
      </div>

      {/* Quality selector — only shown when levels are available */}
      {qualityLevels.length > 0 && (
        <div className="absolute bottom-14 right-3 z-10">
          <button
            onClick={() => setShowQualityMenu((v) => !v)}
            className="flex items-center gap-1 rounded-md bg-black/60 hover:bg-black/80 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
            {currentLabel}
          </button>

          {showQualityMenu && (
            <div className="absolute bottom-8 right-0 min-w-[90px] rounded-lg bg-black/80 backdrop-blur-sm border border-white/10 py-1 overflow-hidden">
              <button
                onClick={() => applyQuality("auto")}
                className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                  selectedQuality === "auto"
                    ? "text-[#a980f0] font-semibold bg-white/10"
                    : "text-white hover:bg-white/10"
                }`}
              >
                Auto
              </button>
              {qualityLevels.map((level) => (
                <button
                  key={level.index}
                  onClick={() => applyQuality(level.index)}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors ${
                    selectedQuality === level.index
                      ? "text-[#a980f0] font-semibold bg-white/10"
                      : "text-white hover:bg-white/10"
                  }`}
                >
                  {level.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
