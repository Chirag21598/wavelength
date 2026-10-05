// Genre lookup via Last.fm tags. Free API, separate from Spotify's quota.
// Needs LASTFM_API_KEY; without it every lookup quietly returns null.

const LASTFM_URL = "https://ws.audioscrobbler.com/2.0/";

import type { GenreBucket } from "./genres";

type Tag = { name: string; count: number };

/** Maps a raw Last.fm tag onto one of the filter chips, or null if none fits. */
function bucketForTag(tag: string): GenreBucket | null {
  const t = tag.toLowerCase();
  if (/lo-?fi|chillhop|lofi/.test(t)) return "Lo-fi";
  if (/hip[- ]?hop|\brap\b|trap/.test(t)) return "Hip-Hop";
  if (/electro|edm|house|techno|trance|dubstep|drum and bass|dance/.test(t)) return "Electronic";
  if (/indie|alternative/.test(t)) return "Indie";
  if (/\bpop\b|synthpop|k-?pop/.test(t)) return "Pop";
  return null;
}

async function topTags(method: "track.getTopTags" | "artist.getTopTags", params: Record<string, string>): Promise<Tag[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  const url = new URL(LASTFM_URL);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    const tags = data?.toptags?.tag;
    if (!Array.isArray(tags)) return [];
    return tags.map((t: { name: string; count: number | string }) => ({ name: String(t.name), count: Number(t.count) || 0 }));
  } catch {
    return [];
  }
}

/**
 * Returns a genre label for a track: one of the filter buckets if any of its
 * top tags fits, otherwise the track's strongest tag. null if Last.fm has
 * nothing (or no API key is configured).
 */
export async function lookupGenre(track: string, artist: string): Promise<string | null> {
  if (!process.env.LASTFM_API_KEY) return null;
  const firstArtist = artist.split(",")[0].trim();
  let tags = await topTags("track.getTopTags", { track, artist: firstArtist });
  if (tags.length === 0) tags = await topTags("artist.getTopTags", { artist: firstArtist });
  const strong = tags.filter((t) => t.count >= 10).sort((a, b) => b.count - a.count);
  for (const t of strong) {
    const bucket = bucketForTag(t.name);
    if (bucket) return bucket;
  }
  const top = strong[0];
  if (!top) return null;
  return top.name.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24);
}
