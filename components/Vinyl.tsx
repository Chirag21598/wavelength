"use client";

import { hueOf, labelBg, initialsOf } from "@/lib/visuals";

export default function Vinyl({
  seed,
  name,
  imageUrl,
  size = 42,
  live = false,
  isMe = false,
  className = "",
}: {
  seed: string;
  name: string | null;
  imageUrl?: string | null;
  size?: number;
  live?: boolean;
  isMe?: boolean;
  className?: string;
}) {
  const hue = hueOf(seed);
  return (
    <div
      className={`vinyl ${live ? "live" : ""} ${isMe ? "me-avatar" : ""} ${className}`}
      style={{ width: size, height: size }}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name ?? "avatar"} />
      ) : (
        <span className="label" style={{ background: labelBg(hue) }}>
          {initialsOf(name)}
        </span>
      )}
    </div>
  );
}
