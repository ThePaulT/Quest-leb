import type { Metadata } from 'next';

import { fontVariables } from '@/lib/ui/fonts';

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
