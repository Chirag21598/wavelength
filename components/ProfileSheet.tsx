"use client";

import { useState, useEffect } from "react";
import { NowPlaying } from "@/lib/types";
import Vinyl from "./Vinyl";
import { relTime } from "@/lib/visuals";

export type SheetTarget = {
  id: string;
  isMe: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  instagram: string | null;
  nowPlaying: NowPlaying | null;
};

export default function ProfileSheet({
  target,
  onClose,
  onSaveInstagram,
  onLogout,
}: {
  target: SheetTarget | null;
  onClose: () => void;
  onSaveInstagram: (value: string) => void;
  onLogout: () => void;
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
              {target.isMe && <p className="sheet-meta">Your Wavelength profile</p>}
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
              </div>
              {np.albumArt && <img className="cover-art" src={np.albumArt} alt="" />}
            </div>
          ) : (
            <div className="sheet-track">
              <div className="sheet-track-info">
                <div className="artist">Not broadcasting right now.</div>
              </div>
            </div>
          )}

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
            target.instagram && (
              <a
                className="ig-link"
                href={`https://instagram.com/${target.instagram}`}
                target="_blank"
                rel="noreferrer"
              >
                @{target.instagram}
              </a>
            )
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
