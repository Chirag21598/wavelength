"use client";

import { Listener } from "@/lib/types";
import { hueOf, initialsOf } from "@/lib/visuals";

function radiusForDistance(m: number) {
  // Purely a visual scale, independent of the API's MAX_RADIUS_M (which no longer
  // caps who can match). Anyone beyond 25km just pins to the outer ring — the radar
  // stays readable for nearby people, and far-away people still show up, just at the edge.
  // The Nearby list view shows everyone's real distance regardless.
  const maxM = 25000,
    maxPx = 148,
    minPx = 34;
  return (Math.min(m, maxM) / maxM) * (maxPx - minPx) + minPx;
}

export default function Radar({
  listeners,
  onSelect,
}: {
  listeners: Listener[];
  onSelect: (l: Listener) => void;
}) {
  return (
    <div className="radar-wrap">
      <svg id="radarSvg" viewBox="40 40 320 320">
        <defs>
          <radialGradient id="youGrad" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </radialGradient>
          {listeners.map((l) => {
            const hue = hueOf(l.id);
            return (
              <radialGradient key={l.id} id={`avGrad-${l.id}`} cx="35%" cy="30%" r="75%">
                <stop offset="0%" stopColor={`hsl(${hue} 80% 66%)`} />
                <stop offset="100%" stopColor={`hsl(${hue} 65% 44%)`} />
              </radialGradient>
            );
          })}
        </defs>

        <circle className="ring" cx="200" cy="200" r="60" />
        <circle className="ring" cx="200" cy="200" r="120" />
        <circle className="ring" cx="200" cy="200" r="182" />
        <text className="ring-label" x="204" y="144">
          5 km
        </text>
        <text className="ring-label" x="204" y="84">
          10 km
        </text>

        <circle className="you-wave w1" cx="200" cy="200" r="20" />
        <circle className="you-wave w2" cx="200" cy="200" r="20" />
        <circle className="you-core" cx="200" cy="200" r="17" />
        <text className="you-label" x="200" y="238" textAnchor="middle">
          YOU
        </text>

        <g id="listenerLayer">
          {listeners.map((l) => {
            const r = radiusForDistance(l.distanceM);
            const x = 200 + r * Math.cos(l.angle);
            const y = 200 + r * Math.sin(l.angle);
            return (
              <g
                key={l.id}
                className="listener-dot"
                onClick={() => onSelect(l)}
                style={{ cursor: "pointer" }}
              >
                <circle className="avatar" cx={x} cy={y} r={17} fill={`url(#avGrad-${l.id})`} />
                <text className="initials" x={x} y={y + 4.2}>
                  {initialsOf(l.displayName)}
                </text>
                {l.nowPlaying.isPlaying && (
                  <circle className="live-blip" cx={x + 13} cy={y - 13} r={4.4} />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
