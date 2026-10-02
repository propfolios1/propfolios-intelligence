"use client";

import * as React from "react";
import { browserSupabase } from "@/lib/supabase/client";
import { useSessionToken } from "./realtime-provider";

export type RealtimeState = "connecting" | "live" | "polling";

export interface RealtimeTable {
  table: "portfolios" | "insights" | "recommendations" | "actions" | "market_data";
  /** PostgREST-style filter, e.g. "client_id=eq.<uuid>". RLS applies regardless. */
  filter?: string;
}

/**
 * Subscribes to Supabase Realtime changes on the given tables with the user's
 * Clerk token; row-level security decides which changes arrive. Falls back to
 * polling (calling onChange on an interval) when Realtime is unavailable, so
 * every screen stays current in demonstration mode too.
 */
export function useRealtime(name: string, tables: RealtimeTable[], onChange: () => void, pollMs = 20_000): RealtimeState {
  const getToken = useSessionToken();
  const [state, setState] = React.useState<RealtimeState>("connecting");
  const cb = React.useRef(onChange);
  cb.current = onChange;
  const key = JSON.stringify(tables);

  React.useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const fire = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => cb.current(), 400);
    };
    const poll = () => {
      setState("polling");
      clearInterval(timer);
      timer = setInterval(() => {
        if (document.visibilityState === "visible") cb.current();
      }, pollMs);
    };
    const sb = getToken ? browserSupabase(getToken) : null;
    if (!sb) {
      poll();
      return () => clearInterval(timer);
    }
    let channel = sb.channel(`nakhla:${name}`);
    for (const t of JSON.parse(key) as RealtimeTable[]) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table: t.table, ...(t.filter ? { filter: t.filter } : {}) }, fire);
    }
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearInterval(timer);
        setState("live");
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") poll();
    });
    return () => {
      clearInterval(timer);
      clearTimeout(debounce);
      void sb.removeChannel(channel);
    };
  }, [getToken, key, name, pollMs]);

  return state;
}
