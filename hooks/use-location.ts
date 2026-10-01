"use client";

import * as React from "react";

export type PositionState = "prompt" | "requesting" | "granted" | "denied" | "unsupported";

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

/**
 * Optional browser geolocation.
 *
 * Deliberately opt-in: we never prompt on page load, and a refusal never
 * blocks recording a refill.
 */
export function useLocation() {
  const [permission, setPermission] = React.useState<PositionState>("prompt");
  const [position, setPosition] = React.useState<GeoPosition | null>(null);
  const [unavailableReason, setUnavailableReason] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    if (typeof navigator.permissions?.query === "function") {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          if (status.state === "denied") setPermission("denied");
          if (status.state === "granted") setPermission("prompt");
        })
        .catch(() => undefined);
    }
  }, []);

  const request = React.useCallback(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission("requesting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setPermission("granted");
      },
      (error) => {
        setPermission("denied");
        setUnavailableReason(
          error.code === error.PERMISSION_DENIED
            ? "Location access is off. Your refill still counts — we'll mark it as location unavailable."
            : "We couldn't get a location fix. Your refill still counts.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  return { permission, position, request, unavailableReason };
}

/** Tracks connectivity so the UI can say something useful when offline. */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}