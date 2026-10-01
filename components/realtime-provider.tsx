"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type RealtimeEventType =
  | "activity.created"
  | "activity.reviewed"
  | "room.status"
  | "notification"
  | "rotation.updated";

export interface RealtimeEvent {
  id: string;
  type: RealtimeEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface RealtimeContextValue {
  connected: boolean;
  lastEvent: RealtimeEvent | null;
  subscribe: (type: RealtimeEventType | "*", handler: (event: RealtimeEvent) => void) => () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  lastEvent: null,
  subscribe: () => () => undefined,
});

type Handler = (event: RealtimeEvent) => void;

export function RealtimeProvider({
  enabled = true,
  children,
}: {
  enabled?: boolean;
  children: React.ReactNode;
}) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const handlers = useRef(new Map<string, Set<Handler>>());
  const sourceRef = useRef<EventSource | null>(null);

  const register = useCallback((key: string, handler: Handler) => {
    const map = handlers.current;
    const set = map.get(key) ?? new Set<Handler>();
    set.add(handler);
    map.set(key, set);
    return () => {
      set.delete(handler);
    };
  }, []);

  const dispatch = useCallback((event: RealtimeEvent) => {
    setLastEvent(event);
    for (const [key, set] of handlers.current) {
      if (key === "*" || key === event.type) {
        for (const handler of set) handler(event);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      const source = new EventSource("/api/realtime/stream");
      sourceRef.current = source;

      source.addEventListener("hello", () => {
        retry = 0;
        setConnected(true);
      });

      for (const type of [
        "activity.created",
        "activity.reviewed",
        "room.status",
        "notification",
        "rotation.updated",
      ] as const) {
        source.addEventListener(type, (message) => {
          try {
            dispatch(JSON.parse((message as MessageEvent).data) as RealtimeEvent);
          } catch {
            /* ignore malformed frames */
          }
        });
      }

      source.onerror = () => {
        setConnected(false);
        source.close();
        // Exponential backoff, capped, so we never hammer the server.
        retry = Math.min(retry + 1, 6);
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry, 30_000));
      };
    };

    connect();

    return () => {
      if (timer) clearTimeout(timer);
      sourceRef.current?.close();
      setConnected(false);
    };
  }, [enabled, dispatch]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      connected,
      lastEvent,
      subscribe: (type, handler) => register(type === "*" ? "*" : type, handler),
    }),
    [connected, lastEvent, register],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

/** Subscribe to one event type for the lifetime of a component. */
export function useRealtimeEvent(
  type: RealtimeEventType | "*",
  handler: Handler,
): void {
  const { subscribe } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribe(type, (event) => ref.current(event)), [subscribe, type]);
}