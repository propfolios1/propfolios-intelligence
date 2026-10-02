"use client";

import { useAuth } from "@clerk/nextjs";
import * as React from "react";

type GetToken = () => Promise<string | null>;

const TokenContext = React.createContext<GetToken | null>(null);

/** Exposes the signed-in user's Clerk session token to Supabase Realtime subscriptions. */
function ClerkTokenBridge({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  const value = React.useMemo<GetToken | null>(() => (isSignedIn ? () => getToken() : null), [getToken, isSignedIn]);
  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

export function RealtimeProvider({ clerk, children }: { clerk: boolean; children: React.ReactNode }) {
  return clerk ? <ClerkTokenBridge>{children}</ClerkTokenBridge> : <TokenContext.Provider value={null}>{children}</TokenContext.Provider>;
}

export const useSessionToken = () => React.useContext(TokenContext);
