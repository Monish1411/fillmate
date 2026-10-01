import "server-only";

/** Great-circle distance in metres between two WGS-84 coordinates. */
export function distanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(a))));
}

export interface LocationEvaluation {
  status: "near" | "far" | "unavailable";
  distanceMeters: number | null;
  accuracy: number | null;
}

/**
 * Compare a reported position against the configured cooler position.
 *
 * Location is an *additional* signal, never a gate: an unavailable or coarse
 * position must not block a student from recording what they actually did.
 */
export function evaluateLocation(
  reported: { latitude: number; longitude: number; accuracy?: number } | null | undefined,
  cooler: {
    latitude: number | null;
    longitude: number | null;
    allowed_radius_m: number | null;
    location_enforced: number;
  } | null,
  featureEnabled: boolean,
): LocationEvaluation {
  if (!featureEnabled || !reported) {
    return { status: "unavailable", distanceMeters: null, accuracy: null };
  }
  if (
    !cooler ||
    cooler.latitude === null ||
    cooler.longitude === null ||
    cooler.allowed_radius_m === null
  ) {
    return { status: "unavailable", distanceMeters: null, accuracy: reported.accuracy ?? null };
  }

  const meters = distanceMeters(
    reported.latitude,
    reported.longitude,
    cooler.latitude,
    cooler.longitude,
  );
  const radius = cooler.allowed_radius_m;
  // A low-accuracy fix should not be treated as a precise "far" reading.
  const effectiveRadius = reported.accuracy ? radius + reported.accuracy : radius;
  const near = meters <= effectiveRadius;

  return {
    status: near ? "near" : "far",
    distanceMeters: meters,
    accuracy: reported.accuracy ?? null,
  };
}

/** Privacy-safe label — never exposes raw coordinates. */
export function locationLabel(
  status: LocationEvaluation["status"],
  meters: number | null,
): string {
  if (status === "unavailable") return "Location unavailable";
  if (status === "near") {
    if (meters === null || meters < 5) return "Near cooler";
    return `${Math.round(meters)}m from cooler`;
  }
  return meters === null ? "Outside cooler area" : `${Math.round(meters)}m from cooler`;
}