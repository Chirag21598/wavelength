/** Stable identity for "the track someone is playing", used for one-mark-per-track novelty. */
export function trackKey(url: string | null | undefined, track: string | null | undefined, artist: string | null | undefined) {
  return url || `${track ?? ""}|${artist ?? ""}`;
}
