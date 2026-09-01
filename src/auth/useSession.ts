import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';

export interface AuthState {
  /** null mientras se resuelve la sesión inicial. */
  session: Session | null;
  ready: boolean;
  configured: boolean;
  email: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useSession(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let alive = true;
    let unsubscribe: (() => void) | undefined;
    void getSupabase().then(async (client) => {
      if (!client || !alive) return;
      const { data } = await client.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      setReady(true);
      const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setReady(true);
      });
      unsubscribe = () => sub.subscription.unsubscribe();
    });
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = useCallback(async () => {
    const client = await getSupabase();
    if (!client) return;
    await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    const client = await getSupabase();
    if (!client) return;
    await client.auth.signOut();
  }, []);

  return {
    session,
    ready,
    configured: isSupabaseConfigured,
    email: session?.user?.email ?? null,
    signIn,
    signOut,
  };
}
