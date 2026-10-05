// Genre lookup. Uses Last.fm tags when LASTFM_API_KEY is set, and falls back to
// MusicBrainz artist tags (free, no key) so genres still show up without one.
// Both are separate from Spotify's quota.

const LASTFM_URL = "https://ws.audioscrobbler.com/2.0/";
const MUSICBRAINZ_URL = "https://musicbrainz.org/ws/2/artist/";
const FETCH_TIMEOUT_MS = 4000;

import type { GenreBucket } from "./genres";

type Tag = { name: string; count: number };

/** Maps a raw tag onto one of the filter chips, or null if none fits. */
function bucketForTag(tag: string): GenreBucket | null {
  const t = tag.toLowerCase();
  if (/lo-?fi|chillhop|lofi/.test(t)) return "Lo-fi";
  if (/hip[- ]?hop|\brap\b|trap/.test(t)) return "Hip-Hop";
  if (/electro|edm|house|techno|trance|dubstep|drum and bass|dance/.test(t)) return "Electronic";
  if (/indie|alternative/.test(t)) return "Indie";
  if (/\bpop\b|synthpop|k-?pop/.test(t)) return "Pop";
  return null;
}

async function lastfmTags(method: "track.getTopTags" | "artist.getTopTags", params: Record<string, string>): Promise<Tag[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  const url = new URL(LASTFM_URL);
  url.searchParams.set("method", method);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("autocorrect", "1");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString(), { cache: "no-store", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = await res.json();
    const tags = data?.toptags?.tag;
    if (!Array.isArray(tags)) return [];
    return tags.map((t: { name: string; count: number | string }) => ({ name: String(t.name), count: Number(t.count) || 0 }));
  } catch {
    return [];
  }
}

async function musicBrainzTags(artist: string): Promise<Tag[]> {
  const url = new URL(MUSICBRAINZ_URL);
  url.searchParams.set("query", 'artist:"' + artist.replace(/"/g, "") + '"');
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "1");
  try {
    const res = await fetch(url.toString(), {
      headers: { "User-Agent": "Wavelength/1.0 (+https://wavelength-chirag-s1.vercel.app)" },
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const hit = data?.artists?.[0];
    // Only trust a close match, otherwise we'd tag the wrong artist.
    if (!hit || Number(hit.score) < 90 || !Array.isArray(hit.tags)) return [];
    return hit.tags.map((t: { name: string; count: number | string }) => ({ name: String(t.name), count: Number(t.count) || 0 }));
  } catch {
    return [];
  }
}

/** One of the filter buckets if any strong tag fits, otherwise the strongest tag. */
function pickGenre(tags: Tag[], minCount: number): string | null {
  const strong = tags.filter((t) => t.count >= minCount).sort((a, b) => b.count - a.count);
  for (const t of strong) {
    const bucket = bucketForTag(t.name);
    if (bucket) return bucket;
  }
  const top = strong[0];
  if (!top) return null;
  return top.name.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24);
}

/**
 * Returns a genre label for a track: one of the filter buckets if any of its
 * top tags fits, otherwise the strongest tag. null if nothing is found.
 */
export async function lookupGenre(track: string, artist: string): Promise<string | null> {
  const firstArtist = artist.split(",")[0].trim();
  if (!firstArtist) return null;

  if (process.env.LASTFM_API_KEY) {
    let tags = await lastfmTags("track.getTopTags", { track, artist: firstArtist });
    if (tags.length === 0) tags = await lastfmTags("artist.getTopTags", { artist: firstArtist });
    const genre = pickGenre(tags, 10);
    if (genre) return genre;
  }

  return pickGenre(await musicBrainzTags(firstArtist), 1);
}
