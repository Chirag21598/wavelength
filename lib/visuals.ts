/** Deterministic hash -> hue, so the same person always gets the same fallback color. */
export function hueOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

export function labelBg(hue: number): string {
  return `conic-gradient(from 210deg, hsl(${hue} 80% 62%), hsl(${(hue + 60) % 360} 80% 55%), hsl(${hue} 80% 62%))`;
}

export function vinylTint(hue: number): { a: string; b: string } {
  return {
    a: `hsl(${hue} 70% 78%)`,
    b: `hsl(${(hue + 30) % 360} 60% 58%)`,
  };
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "3m ago", "2h ago", etc. */
export function relTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs}h ago`;
}
