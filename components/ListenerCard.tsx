"use client";

import { Listener } from "@/lib/types";
import Vinyl from "./Vinyl";

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

export default function ListenerCard({
  listener,
  onSelect,
}: {
  listener: Listener;
  onSelect: (l: Listener) => void;
}) {
  const live = listener.nowPlaying.isPlaying;
  return (
    <div className="listener-card" onClick={() => onSelect(listener)}>
      <Vinyl
        seed={listener.id}
        name={listener.displayName}
        imageUrl={listener.avatarUrl}
        size={48}
        live={live}
        className="avatar-circle"
      />
      <div className="card-main">
        <div className="card-top">
          <span className="card-name">{listener.displayName ?? "Someone nearby"}</span>
          <span className="card-dist">{formatDistance(listener.distanceM)}</span>
        </div>
        <div className="card-track">
          {live ? "Playing " : "Last played "}
          <strong>{listener.nowPlaying.track}</strong>
          {listener.nowPlaying.artist ? ` · ${listener.nowPlaying.artist}` : ""}
        </div>
      </div>
      {live && (
        <div className="eq">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}
