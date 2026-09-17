'use client';

import { useCallback, useEffect, useState } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

/**
 * The signed-in user's access token.
 *
 * Two sources, in order:
 *   1. Supabase, when the project is configured — the real path.
 *   2. A token in sessionStorage put there by the dev sign-in route, for local
 *      work against the Docker-less shim, which has no GoTrue at all.
 *
 * sessionStorage rather than localStorage on purpose: the dev token dies with
 * the tab, so it cannot linger on a shared machine.
 */
export const DEV_TOKEN_KEY = 'quest-leb.dev-token';
export const DEV_EMAIL_KEY = 'quest-leb.dev-email';

export interface SessionState {
  loading: boolean;
  token: string | null;
  email: string | null;
  isDev: boolean;
  signOut: () => Promise<void>;
}

export function useSession(): SessionState {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isDev, setIsDev] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const readDevToken = () => {
      try {
        const stored = sessionStorage.getItem(DEV_TOKEN_KEY);
        if (stored && !cancelled) {
          setToken(stored);
          setEmail(sessionStorage.getItem(DEV_EMAIL_KEY));
          setIsDev(true);
        }
      } catch {
        // sessionStorage can throw in private mode; a signed-out UI is correct.
      }
    };

    const supabase = getSupabase();

    // Both paths resolve through a promise so that no state is written
    // synchronously inside the effect — React rightly objects to that, and the
    // unconfigured case is just a session that is already known to be absent.
    const initial = supabase
      ? supabase.auth.getSession().then(({ data }) => data.session)
      : Promise.resolve(null);

    initial.then((session) => {
      if (cancelled) return;
      if (session) {
        setToken(session.access_token);
        setEmail(session.user.email ?? null);
        setIsDev(false);
      } else {
        readDevToken();
      }
      setLoading(false);
    });

    const listener = supabase?.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setToken(session?.access_token ?? null);
      setEmail(session?.user.email ?? null);
      setIsDev(false);
    });

    return () => {
      cancelled = true;
      listener?.data.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      sessionStorage.removeItem(DEV_TOKEN_KEY);
      sessionStorage.removeItem(DEV_EMAIL_KEY);
    } catch {
      // Ignore: clearing a store we could not read is not a failure.
    }
    if (isSupabaseConfigured()) {
      await getSupabase()?.auth.signOut();
    }
    setToken(null);
    setEmail(null);
    setIsDev(false);
  }, []);

  return { loading, token, email, isDev, signOut };
}
