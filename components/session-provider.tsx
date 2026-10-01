"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionUser } from "@/types/views";

interface SessionContextValue {
  user: SessionUser | null;
  loading: boolean;
  setUser: (user: SessionUser | null) => void;
  refresh: () => Promise<void>;
  isAdmin: boolean;
  capabilities: { aiVerification: boolean; aiProvider: string; aiModel: string; demoMode: boolean };
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  initialUser = null,
  initialCapabilities = {
    aiVerification: false,
    aiProvider: "local",
    aiModel: "heuristic-v1",
    demoMode: false,
  },
}: {
  children: React.ReactNode;
  initialUser?: SessionUser | null;
  initialCapabilities?: SessionContextValue["capabilities"];
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] =
    useState<SessionContextValue["capabilities"]>(initialCapabilities);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const payload = await res.json();
      if (payload?.ok) {
        setUser(payload.data.user);
        setCapabilities(payload.data.capabilities);
      } else {
        setUser(null);
      }
    } catch {
      /* offline: keep the last known user */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialUser) void refresh();
  }, [initialUser, refresh]);

  const value = useMemo<SessionContextValue>(
    () => ({
      user,
      loading,
      setUser,
      refresh,
      isAdmin: user?.role === "hostel_admin" || user?.role === "super_admin",
      capabilities,
    }),
    [user, loading, refresh, capabilities],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}