"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MeResponse, NearbyResponse, Listener } from "@/lib/types";
import Radar from "./Radar";
import ListenerCard from "./ListenerCard";
import TurntableCard from "./TurntableCard";
import ProfileSheet, { SheetTarget } from "./ProfileSheet";
import Vinyl from "./Vinyl";

const ME_POLL_MS = 30_000;
const NEARBY_POLL_MS = 12_000;
const MIN_LOCATION_POST_MS = 15_000;

type AuthState = "loading" | "signed-out" | "signed-in";

export default function WavelengthApp() {
  const searchParams = useSearchParams();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [me, setMe] = useState<MeResponse | null>(null);
  const [listeners, setListeners] = useState<Listener[]>([]);
  const [needsLocation, setNeedsLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [activeTab, setActiveTab] = useState<"radar" | "list">("radar");
  const [sheetTarget, setSheetTarget] = useState<SheetTarget | null>(null);
  const [filterMode, setFilterMode] = useState<"all" | "live">("all");
  const [toast, setToast] = useState<string | null>(null);

  const lastLocationPostRef = useRef(0);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const fetchMe = useCallback(async () => {
    const res = await fetch("/api/me");
    if (res.status === 401) {
      setAuthState("signed-out");
      setMe(null);
      return;
    }
    if (!res.ok) return;
    const data: MeResponse = await res.json();
    setMe(data);
    setAuthState("signed-in");
  }, []);

  const fetchNearby = useCallback(async () => {
    const res = await fetch("/api/nearby");
    if (res.status === 401) {
      setAuthState("signed-out");
      return;
    }
    if (!res.ok) return;
    const data: NearbyResponse = await res.json();
    setListeners(data.listeners ?? []);
    setNeedsLocation(Boolean(data.needsLocation));
  }, []);

  // Surface OAuth errors passed back via ?error=
  useEffect(() => {
    const err = searchParams.get("error");
    if (!err) return;
    const messages: Record<string, string> = {
      invalid_state: "Spotify login expired — try connecting again.",
      auth_failed: "Couldn't finish connecting to Spotify. Try again.",
      access_denied: "Spotify access was declined.",
      spotify_quota: "Spotify is limiting this app right now (dev quota). Try again in a bit.",
      not_allowed: "This Spotify account hasn't been added to the app yet — ask Chirag to add you.",
    };
    showToast(messages[err] ?? "Something went wrong connecting to Spotify.");
  }, [searchParams, showToast]);

  // Initial auth check.
  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Polling loops, only once signed in.
  useEffect(() => {
    if (authState !== "signed-in") return;
    fetchNearby();
    const meTimer = setInterval(fetchMe, ME_POLL_MS);
    const nearbyTimer = setInterval(fetchNearby, NEARBY_POLL_MS);
    return () => {
      clearInterval(meTimer);
      clearInterval(nearbyTimer);
    };
  }, [authState, fetchMe, fetchNearby]);

  // Real browser geolocation — never simulated.
  useEffect(() => {
    if (authState !== "signed-in") return;
    if (!("geolocation" in navigator)) {
      showToast("This browser doesn't support location sharing.");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setLocationDenied(false);
        const now = Date.now();
        if (now - lastLocationPostRef.current < MIN_LOCATION_POST_MS) return;
        lastLocationPostRef.current = now;
        fetch("/api/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        })
          .then(() => fetchNearby())
          .catch(() => {});
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setLocationDenied(true);
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [authState, fetchNearby, showToast]);

  const handleControl = useCallback(
    async (action: "play" | "pause" | "next" | "previous") => {
      const res = await fetch(`/api/playback/${action}`, { method: "POST" });
      if (!res.ok) {
        showToast("No active Spotify device — open Spotify and start playing something.");
        return;
      }
      setTimeout(fetchMe, 700);
    },
    [fetchMe, showToast]
  );

  const handleSaveInstagram = useCallback(
    async (value: string) => {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram: value }),
      });
      if (!res.ok) {
        showToast("Couldn't save your Instagram handle.");
        return;
      }
      const data = await res.json();
      setMe((prev) => (prev ? { ...prev, user: { ...prev.user, instagram: data.instagram } } : prev));
      setSheetTarget((prev) => (prev ? { ...prev, instagram: data.instagram } : prev));
      showToast("Profile updated.");
    },
    [showToast]
  );

  const handleLogout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setMe(null);
    setListeners([]);
    setSheetTarget(null);
    setAuthState("signed-out");
  }, []);

  const openMeSheet = () => {
    if (!me) return;
    setSheetTarget({
      id: me.user.id,
      isMe: true,
      displayName: me.user.displayName,
      avatarUrl: me.user.avatarUrl,
      instagram: me.user.instagram,
      nowPlaying: me.nowPlaying,
    });
  };

  const openListenerSheet = (l: Listener) => {
    setSheetTarget({
      id: l.id,
      isMe: false,
      displayName: l.displayName,
      avatarUrl: l.avatarUrl,
      instagram: l.instagram,
      nowPlaying: l.nowPlaying,
    });
  };

  const visibleListeners =
    filterMode === "live" ? listeners.filter((l) => l.nowPlaying.isPlaying) : listeners;

  if (authState === "loading") {
    return (
      <div className="page">
        <div className="app">
          <div className="loading-screen">
            <div className="spinner" />
          </div>
        </div>
      </div>
    );
  }

  if (authState === "signed-out") {
    return (
      <div className="page">
        <div className="app">
          <div className="login-screen">
            <div className="brand-mark" style={{ width: 56, height: 56 }}>
              <span />
              <span />
              <span />
            </div>
            <h1>Wavelength</h1>
            <p>Find out what people near you are listening to — in real time, with your real Spotify activity.</p>
            <a className="spotify-connect" href="/api/auth/login">
              Connect with Spotify
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <span></span>
              <span></span>
              <span></span>
            </span>
            <div>
              <h1>Wavelength</h1>
              <p className="tagline">Music by proximity</p>
            </div>
          </div>
          <button type="button" className="profile-btn" aria-label="My profile" onClick={openMeSheet}>
            <Vinyl
              seed={me?.user.id ?? "me"}
              name={me?.user.displayName ?? null}
              imageUrl={me?.user.avatarUrl}
              size={34}
              isMe
              className="profile-avatar"
            />
          </button>
        </header>

        <div className="filter-bar">
          <button
            type="button"
            className={`filter-chip ${filterMode === "all" ? "active" : ""}`}
            onClick={() => setFilterMode("all")}
          >
            All ({listeners.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filterMode === "live" ? "active" : ""}`}
            onClick={() => setFilterMode("live")}
          >
            <span className="dot" />
            Live now ({listeners.filter((l) => l.nowPlaying.isPlaying).length})
          </button>
        </div>

        <div className="stage">
          <section className="view" id="radarView" style={{ display: activeTab === "radar" ? "flex" : "none" }}>
            {needsLocation || locationDenied ? (
              <div className="empty-state">
                <h3>Turn on location</h3>
                <p>
                  {locationDenied
                    ? "Location access was blocked. Enable it for this site in your browser settings to appear on the radar and see who's nearby."
                    : "Allow location access when your browser asks, so Wavelength can find real listeners near you."}
                </p>
              </div>
            ) : (
              <>
                <Radar listeners={visibleListeners} onSelect={openListenerSheet} />
                <p className="radar-hint">
                  {visibleListeners.length > 0
                    ? "Each dot is a real nearby listener, placed by their real distance and direction. Tap one to see what they're playing."
                    : filterMode === "live"
                    ? "No one is actively playing right now. Switch to \"All\" to see everyone who broadcast recently."
                    : "No one nearby is broadcasting right now. Get a friend to connect their Spotify too and test it together."}
                </p>
              </>
            )}
          </section>

          <section className="view" style={{ display: activeTab === "list" ? "block" : "none" }}>
            {visibleListeners.length === 0 ? (
              <div className="empty-state">
                <h3>Nobody nearby yet</h3>
                <p>Once someone near you connects Spotify and plays something, they&apos;ll show up here.</p>
              </div>
            ) : (
              visibleListeners.map((l) => <ListenerCard key={l.id} listener={l} onSelect={openListenerSheet} />)
            )}
          </section>
        </div>

        <TurntableCard nowPlaying={me?.nowPlaying ?? null} seed={me?.user.id ?? "me"} onControl={handleControl} />

        <nav className="pill-nav">
          <button
            type="button"
            className={`pill-tab ${activeTab === "radar" ? "active" : ""}`}
            onClick={() => setActiveTab("radar")}
          >
            <svg className="pill-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="2.4" fill="currentColor" />
              <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.6" opacity=".65" />
              <circle cx="12" cy="12" r="10.4" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".35" />
            </svg>
            Radar
          </button>
          <button
            type="button"
            className={`pill-tab ${activeTab === "list" ? "active" : ""}`}
            onClick={() => setActiveTab("list")}
          >
            <svg className="pill-icon" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="6" width="16" height="2.2" rx="1.1" fill="currentColor" />
              <rect x="4" y="11" width="16" height="2.2" rx="1.1" fill="currentColor" />
              <rect x="4" y="16" width="16" height="2.2" rx="1.1" fill="currentColor" />
            </svg>
            Nearby list
          </button>
        </nav>
      </div>

      <ProfileSheet
        target={sheetTarget}
        onClose={() => setSheetTarget(null)}
        onSaveInstagram={handleSaveInstagram}
        onLogout={handleLogout}
      />

      <div className={`toast ${toast ? "show" : ""}`}>{toast}</div>
    </div>
  );
}
