"use client";

import { NowPlaying } from "@/lib/types";
import { vinylTint, relTime } from "@/lib/visuals";

export default function TurntableCard({
  nowPlaying,
  seed,
  onControl,
}: {
  nowPlaying: NowPlaying | null;
  seed: string;
  onControl: (action: "play" | "pause" | "next" | "previous") => void;
}) {
  if (!nowPlaying || !nowPlaying.track) {
    return (
      <div className="np-dock">
        <div className="np-label">
          <span>Nothing to broadcast</span> <span className="np-label-brand">Spotify</span>
        </div>
      </div>
    );
  }

  const tint = vinylTint(
    Array.from(seed).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0) % 360
  );
  const isPlaying = nowPlaying.isPlaying;
  const progressPct =
    nowPlaying.progressMs != null && nowPlaying.durationMs
      ? Math.min(100, (nowPlaying.progressMs / nowPlaying.durationMs) * 100)
      : isPlaying
      ? 100
      : 0;

  return (
    <div className="np-dock">
      <div className="np-label">
        <span>{isPlaying ? "You're playing" : "You last played"}</span>{" "}
        <span className="np-label-brand">Spotify</span>
      </div>
      <div className="turntable-card">
        <div className="tt-info">
          <div className="tt-title">{nowPlaying.track}</div>
          <div className="tt-artist">
            <span>{nowPlaying.artist}</span>
            {!isPlaying && <span className="tt-status">{relTime(nowPlaying.playedAt)}</span>}
          </div>
          <div className="tt-progress">
            <div className="tt-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="tt-controls">
            <button
              type="button"
              className="tt-btn"
              aria-label="Previous track"
              onClick={() => onControl("previous")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M6 5h2v14H6zM20 5L9 12l11 7z" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className="tt-btn tt-play"
              aria-label={isPlaying ? "Pause" : "Play"}
              onClick={() => onControl(isPlaying ? "pause" : "play")}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24">
                  <path d="M7 5h4v14H7zM13 5h4v14h-4z" fill="currentColor" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              )}
            </button>
            <button
              type="button"
              className="tt-btn"
              aria-label="Next track"
              onClick={() => onControl("next")}
            >
              <svg viewBox="0 0 24 24">
                <path d="M16 5h2v14h-2zM4 5l11 7-11 7z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
        <div className="tt-disc-wrap">
          <div
            className={`tt-vinyl ${isPlaying ? "playing" : ""}`}
            style={{ ["--vinyl-a" as string]: tint.a, ["--vinyl-b" as string]: tint.b }}
          >
            {nowPlaying.albumArt && <img className="tt-cover" src={nowPlaying.albumArt} alt="" />}
          </div>
          <svg className={`tt-tonearm ${isPlaying ? "on" : ""}`} viewBox="0 0 40 60" aria-hidden="true">
            <circle cx="30" cy="10" r="6" fill="#2a2632" stroke="#fff" strokeWidth="2" />
            <line x1="30" y1="10" x2="10" y2="52" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="10" cy="52" r="2.2" fill="#fff" />
          </svg>
        </div>
      </div>
    </div>
  );
}
