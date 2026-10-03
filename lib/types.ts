export type NowPlaying = {
  isPlaying: boolean;
  track: string | null;
  artist: string | null;
  albumArt: string | null;
  playedAt: string | null;
  progressMs?: number | null;
  durationMs?: number | null;
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
};

export type Listener = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  instagram: string | null;
  distanceM: number;
  angle: number;
  nowPlaying: NowPlaying;
};

export type NearbyResponse = {
  listeners: Listener[];
  needsLocation: boolean;
  error?: string;
};
