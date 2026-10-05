export type NowPlaying = {
  isPlaying: boolean;
  track: string | null;
  artist: string | null;
  albumArt: string | null;
  playedAt: string | null;
  progressMs?: number | null;
  durationMs?: number | null;
  /** Spotify web link for the track (opens in the Spotify app). */
  url?: string | null;
  /** Genre label (Lo-fi / Indie / Electronic / Hip-Hop / Pop, or a raw top tag). */
  genre?: string | null;
};

export type WaveReceived = {
  fromId: string;
  fromName: string | null;
  at: string;
};

export type MeResponse = {
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    instagram: string | null;
  };
  location: { lat: number; lng: number; updatedAt: string } | null;
  nowPlaying: NowPlaying | null;
  noveltyScore: number;
  appreciationScore: number;
  waves: { unseen: number; total: number; recent: WaveReceived[] };
};

export type Listener = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  instagram: string | null;
  distanceM: number;
  angle: number;
  nowPlaying: NowPlaying;
  noveltyScore: number;
  appreciationScore: number;
  /** I already marked this listener's current track as new to me. */
  hasMarked: boolean;
  /** I already waved at this listener recently (cooldown still active). */
  hasWaved: boolean;
};

export type NearbyResponse = {
  listeners: Listener[];
  needsLocation: boolean;
  error?: string;
};
