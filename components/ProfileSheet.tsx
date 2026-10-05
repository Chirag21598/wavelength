"use client";

import { useState, useEffect } from "react";
import { NowPlaying, MeResponse } from "@/lib/types";
import Vinyl from "./Vinyl";
import { relTime } from "@/lib/visuals";

export type SheetTarget = {
  id: string;
  isMe: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  instagram: string | null;
  nowPlaying: NowPlaying | null;
  distanceM?: number | null;
  noveltyScore: number;
  appreciationScore: number;
  hasMarked?: boolean;
  hasWaved?: boolean;
  waves?: MeResponse["waves"];
};

function formatAway(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

export default function ProfileSheet({
  target,
  onClose,
  onSaveInstagram,
  onLogout,
  onMarkNovel,
  onWave,
}: {
  target: SheetTarget | null;
  onClose: () => void;
  onSaveInstagram: (value: string) => void;
  onLogout: () => void;
  onMarkNovel: (target: SheetTarget) => void;
  onWave: (target: SheetTarget) => void;
}) {
  const [igDraft, setIgDraft] = useState("");

  useEffect(() => {
    setIgDraft(target?.instagram ?? "");
  }, [target?.id, target?.instagram]);

  const open = Boolean(target);
  const np = target?.nowPlaying;

  return (
    <div className={`sheet-backdrop ${open ? "open" : ""}`} onClick={onClose}>
      {target && (
        <div className="sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-grip" />
          <button type="button" className="sheet-x" onClick={onClose} aria-label="Close">
            ✕
          </button>

          <div className="sheet-head">
            <Vinyl
              seed={target.id}
              name={target.displayName}
              imageUrl={target.avatarUrl}
              size={56}
              isMe={target.isMe}
              className="sheet-avatar"
            />
            <div>
              <h3 className="sheet-name">{target.displayName ?? "Someone nearby"}</h3>
              {target.isMe ? (
                <p className="sheet-meta">Your Wavelength profile</p>
              ) : (
                <p className="sheet-meta">
                  {target.distanceM != null ? `${formatAway(target.distanceM)} · ` : ""}
                  {np?.track ? (np.isPlaying ? "listening now" : "last played") : "not broadcasting"}
                </p>
              )}
            </div>
          </div>

          {np?.track ? (
            <div className="sheet-track">
              <div className="sheet-track-info">
                <div className="np-label">
                  <span>{np.isPlaying ? "Playing now" : "Last played"}</span>{" "}
                  <span className="np-label-brand">Spotify</span>
                </div>
                <div className="title">{np.track}</div>
                <div className="artist">
                  {np.artist}
                  {!np.isPlaying && np.playedAt ? ` · ${relTime(np.playedAt)}` : ""}
                </div>
                {np.genre && <span className="genre-pill">{np.genre}</span>}
              </div>
              {np.albumArt && <img className="cover-art" src={np.albumArt} alt="" />}
              {np.url && (
                <a
                  className="play-spotify"
                  href={np.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Play ${np.track} on Spotify`}
                  title="Play on Spotify"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />
                  </svg>
                </a>
              )}
            </div>
          ) : (
            <div className="sheet-track">
              <div className="sheet-track-info">
                <div className="artist">Not broadcasting right now.</div>
              </div>
            </div>
          )}

          <div className="sheet-stats">
            <div className="stat-card">
              <div className="stat-num novelty">
                <span aria-hidden="true">✨</span> {target.noveltyScore}
              </div>
              <div className="stat-label">Novelty received</div>
            </div>
            <div className="stat-card">
              <div className="stat-num appreciation">
                <span aria-hidden="true">🎧</span> {target.appreciationScore}
              </div>
              <div className="stat-label">Appreciation given</div>
            </div>
          </div>

          {target.isMe ? (
            <>
              <div className="ig-field">
                <label htmlFor="ig-input">Instagram</label>
                <div className="ig-row">
                  <input
                    id="ig-input"
                    value={igDraft}
                    onChange={(e) => setIgDraft(e.target.value)}
                    placeholder="yourhandle"
                  />
                  <button type="button" onClick={() => onSaveInstagram(igDraft)}>
                    Save
                  </button>
                </div>
              </div>
              {target.waves && (
                <div className="waves-box">
                  <div className="waves-title">👋 Waves received{target.waves.total > 0 ? ` · ${target.waves.total}` : ""}</div>
                  {target.waves.recent.length === 0 ? (
                    <div className="waves-empty">No waves yet. They show up here when someone nearby says hi.</div>
                  ) : (
                    target.waves.recent.map((w, i) => (
                      <div className="wave-row" key={`${w.fromId}-${w.at}-${i}`}>
                        <strong>{w.fromName ?? "Someone"}</strong> waved · {relTime(w.at)}
                      </div>
                    ))
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={onLogout}
                style={{
                  marginTop: 16,
                  background: "none",
                  border: "none",
                  color: "var(--text-dim)",
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              {target.instagram && (
                <div className="ig-card">
                  <div className="ig-card-label">Instagram</div>
                  <a
                    className="ig-link"
                    href={`https://instagram.com/${target.instagram}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    @{target.instagram}
                  </a>
                </div>
              )}
              <div className="sheet-actions">
                <button
                  type="button"
                  className="btn-new"
                  disabled={!np?.track || target.hasMarked}
                  onClick={() => onMarkNovel(target)}
                >
                  {target.hasMarked ? "✓ Marked as new" : "✨ That's new to me"}
                </button>
                <button
                  type="button"
                  className="btn-wave"
                  disabled={target.hasWaved}
                  onClick={() => onWave(target)}
                >
                  {target.hasWaved ? "👋 Wave sent" : "👋 Send a wave"}
                </button>
              </div>
            </>
          )}

          <p className="sheet-disclaimer">
            {target.isMe
              ? "Only your real-time Spotify activity and location power Wavelength — nothing here is simulated."
              : "This person's location and now-playing data update in real time from their own device."}
          </p>
        </div>
      )}
    </div>
  );
}
