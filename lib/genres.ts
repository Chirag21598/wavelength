/** The genre filter chips. Last.fm tags are mapped onto these (see lib/lastfm.ts). */
export const GENRE_BUCKETS = ["Lo-fi", "Indie", "Electronic", "Hip-Hop", "Pop"] as const;
export type GenreBucket = (typeof GENRE_BUCKETS)[number];
