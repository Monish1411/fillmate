import "server-only";
import { getSql } from "@/lib/db/client";
import { uuid } from "@/lib/utils/id";

/**
 * Realtime fan-out.
 *
 * Events are written to `realtime_events` (durable, replayable) and pushed to
 * in-process SSE subscribers. The SSE endpoint also tails the table, so the
 * feed stays live across multiple server instances — which matters on Vercel.
 */

export type RealtimeEventType =
  | "activity.created"
  | "activity.reviewed"
  | "room.status"
  | "notification"
  | "rotation.updated"
  | "hello"
  | "ping";

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  hostelId: string | null;
  roomId: string | null;
  userId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

type Listener = (event: RealtimeEvent) => void;

const GLOBAL_KEY = Symbol.for("fillmate.realtime");
interface RealtimeBus {
  listeners: Set<Listener>;
  recent: RealtimeEvent[];
}

function bus(): RealtimeBus {
  const g = globalThis as typeof globalThis & { [GLOBAL_KEY]?: RealtimeBus };
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = { listeners: new Set(), recent: [] };
  return g[GLOBAL_KEY];
}

export function subscribe(listener: Listener): () => void {
  const b = bus();
  b.listeners.add(listener);
  return () => b.listeners.delete(listener);
}

function push(event: RealtimeEvent): void {
  const b = bus();
  b.recent.push(event);
  if (b.recent.length > 200) b.recent.shift();
  for (const listener of b.listeners) {
    try {
      listener(event);
    } catch {
      /* a broken subscriber must not break the others */
    }
  }
}

/**
 * Persist + broadcast an event. Scoping is by hostel (and room when present)
 * so a subscriber only ever receives events it is entitled to see.
 */
export async function publish(
  type: RealtimeEventType,
  scope: {
    hostelId: string | null;
    roomId?: string | null;
    userId?: string | null;
  },
  payload: Record<string, unknown> = {},
): Promise<RealtimeEvent> {
  const event: RealtimeEvent = {
    id: uuid(),
    type,
    hostelId: scope.hostelId,
    roomId: scope.roomId ?? null,
    userId: scope.userId ?? null,
    payload,
    createdAt: new Date().toISOString(),
  };

  push(event);

  try {
    const sql = await getSql();
    await sql.execute(
      `INSERT INTO "realtime_events" ("id", "hostel_id", "room_id", "type", "payload", "created_at")
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        event.id,
        event.hostelId,
        event.roomId,
        event.type,
        JSON.stringify({ ...payload, userId: event.userId }),
        event.createdAt,
      ],
    );
    // Keep the replay window small — this is a bus, not an archive.
    await sql.execute(
      `DELETE FROM "realtime_events" WHERE "created_at" < ?`,
      [new Date(Date.now() - 3600_000).toISOString()],
    );
  } catch {
    // A storage failure must not break the user-facing action that caused it.
  }

  return event;
}

/** Events persisted after `since`, for cross-instance replay. */
export async function eventsSince(
  since: string,
  scope: { hostelId: string; roomId: string | null },
): Promise<RealtimeEvent[]> {
  const sql = await getSql();
  const rows = await sql.query<{
    id: string;
    type: string;
    hostel_id: string | null;
    room_id: string | null;
    payload: string;
    created_at: string;
  }>(
    `SELECT * FROM "realtime_events"
      WHERE "created_at" > ? AND "hostel_id" = ?
        ${scope.roomId ? `AND "room_id" = ?` : ""}
      ORDER BY "created_at" ASC LIMIT 100`,
    scope.roomId ? [since, scope.hostelId, scope.roomId] : [since, scope.hostelId],
  );

  return rows.map((row) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    const { userId, ...rest } = payload;
    return {
      id: row.id,
      type: row.type as RealtimeEventType,
      hostelId: row.hostel_id,
      roomId: row.room_id,
      userId: typeof userId === "string" ? userId : null,
      payload: rest,
      createdAt: row.created_at,
    };
  });
}

/** Can this subscriber receive this event? */
export function isVisible(
  event: RealtimeEvent,
  viewer: { userId: string; hostelId: string | null; roomId: string | null; isAdmin: boolean },
): boolean {
  if (event.userId && event.userId === viewer.userId) return true;
  if (!viewer.hostelId || event.hostelId !== viewer.hostelId) return false;
  if (event.roomId) {
    if (viewer.isAdmin) return true;
    return event.roomId === viewer.roomId;
  }
  return viewer.isAdmin;
}