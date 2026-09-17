'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { dirFor, t, type Locale } from '@/lib/i18n';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';
import { DEV_EMAIL_KEY, DEV_TOKEN_KEY } from '@/lib/useSession';

/**
 * Sign-in. Magic link only — no password field to forget, reset or leak.
 *
 * The developer button appears only when the server says the dev route is
 * live, which it never is in production.
 */
export function SignInForm({ locale, next }: { locale: Locale; next: string }) {
  const copy = t(locale);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [devAvailable, setDevAvailable] = useState(false);

  useEffect(() => {
    fetch('/api/dev-sign-in')
      .then((r) => r.json())
      .then((d) => setDevAvailable(Boolean(d?.available)))
      .catch(() => setDevAvailable(false));
  }, []);

  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setState('error');
      return;
    }
    setState('sending');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${next}` },
    });
    setState(error ? 'error' : 'sent');
  }

  async function devSignIn() {
    setState('sending');
    try {
      const response = await fetch('/api/dev-sign-in', { method: 'POST' });
      if (!response.ok) throw new Error('unavailable');
      const { token, email: devEmail } = await response.json();
      sessionStorage.setItem(DEV_TOKEN_KEY, token);
      sessionStorage.setItem(DEV_EMAIL_KEY, devEmail);
      router.push(next);
      router.refresh();
    } catch {
      setState('error');
    }
  }

  return (
    <div
      lang={locale}
      dir={dirFor(locale)}
      className="flex min-h-dvh items-center justify-center bg-base px-5 py-12"
    >
      <div className="w-full max-w-[44ch] border border-sand bg-base px-5 py-6">
        <p className="font-body text-[11px] font-medium uppercase tracking-[0.16em] text-accent">
          {copy.common.appName}
        </p>
        <h1 className="font-display mt-1.5 text-[30px] leading-[1.15] text-ink">
          {copy.auth.title}
        </h1>
        <hr className="mt-4 border-0 border-t border-sand" />

        {state === 'sent' ? (
          <div className="mt-4">
            <p className="font-display text-[20px] leading-[1.3] text-ink">
              {copy.auth.linkSent}
            </p>
            <p className="font-body mt-2 text-[14px] leading-[1.6] text-ink">
              {copy.auth.linkSentBody}
            </p>
          </div>
        ) : (
          <>
            <p className="font-body mt-4 text-[14px] leading-[1.65] text-ink">
              {copy.auth.intro}
            </p>

            <form onSubmit={sendLink} className="mt-5">
              <label
                htmlFor="email"
                className="font-body block text-[11px] uppercase tracking-[0.14em] text-sea"
              >
                {copy.auth.email}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.auth.emailPlaceholder}
                disabled={!isSupabaseConfigured()}
                className="font-body mt-1.5 w-full rounded-[2px] border border-sand bg-base px-3 py-2 text-[15px] text-ink outline-none placeholder:text-sand focus:border-ink disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={state === 'sending' || !isSupabaseConfigured()}
                className="font-body mt-3 w-full rounded-[2px] border border-primary bg-primary px-4 py-2.5 text-[14px] text-base transition-colors hover:bg-ink hover:border-ink disabled:opacity-50"
              >
                {state === 'sending' ? copy.auth.sending : copy.auth.sendLink}
              </button>
            </form>

            {!isSupabaseConfigured() && (
              <p className="font-body mt-3 text-[12px] leading-[1.6] text-sea">
                NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are not set, so
                email sign-in is unavailable here.
              </p>
            )}

            {state === 'error' && (
              <p className="font-body mt-3 text-[13px] leading-[1.6] text-accent">
                {copy.auth.failed}
              </p>
            )}

            {devAvailable && (
              <>
                <hr className="mt-5 border-0 border-t border-sand" />
                <button
                  type="button"
                  onClick={devSignIn}
                  className="font-body mt-4 w-full rounded-[2px] border border-sand bg-base px-4 py-2.5 text-[14px] text-ink transition-colors hover:border-ink"
                >
                  {copy.auth.devSignIn}
                </button>
                <p className="font-body mt-2 text-[11px] uppercase tracking-[0.12em] text-sea">
                  {copy.auth.devSignInNote}
                </p>
              </>
            )}
          </>
        )}

        <hr className="mt-5 border-0 border-t border-sand" />
        <Link
          href={next}
          className="font-body mt-3 inline-block text-[13px] text-sea underline underline-offset-4"
        >
          {copy.common.back}
        </Link>
      </div>
    </div>
  );
}

export default SignInForm;
