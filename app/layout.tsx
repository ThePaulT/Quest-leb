import type { Metadata } from 'next';

import { fontVariables } from '@/lib/ui/fonts';

// Order matters. MapLibre's stylesheet must load BEFORE globals.css: the map
// control overrides at the bottom of globals.css only win the cascade if they
// come second. Imported from here rather than via an @import inside the CSS,
// because a bare package specifier in CSS is resolved by the CSS pipeline and
// fails on some installs.
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lebanon Quest',
  description: 'Complete quests at real Lebanese locations and earn regional badges.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" dir="ltr" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
