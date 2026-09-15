import type { Metadata } from 'next';
import Link from 'next/link';

import './globals.css';

export const metadata: Metadata = {
  title: 'JJK Gauntlet',
  description:
    'Draft a trio, run the five-rung ladder, and find out how far you get. Jujutsu Kaisen fan project.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5">
          <header className="flex items-baseline justify-between border-b border-sand py-5">
            <Link href="/" className="display text-xl tracking-[0.22em] uppercase">
              JJK Gauntlet
            </Link>
            <nav className="flex gap-5 text-xs tracking-[0.14em] uppercase text-ash">
              <Link href="/gauntlet" className="hover:text-bone">
                Gauntlet
              </Link>
              <Link href="/freestyle" className="hover:text-bone">
                Freestyle
              </Link>
              <Link href="/daily" className="hover:text-bone">
                Daily
              </Link>
            </nav>
          </header>
          <main className="flex-1 py-8">{children}</main>
          <footer className="border-t border-sand py-5 text-xs text-ash">
            Unofficial fan project. Original manga ch. 1–271, peak versions. Outcomes are decided by
            the engine; the story text is written afterwards.
          </footer>
        </div>
      </body>
    </html>
  );
}
