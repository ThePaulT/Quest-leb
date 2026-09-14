import { Amiri, IBM_Plex_Sans, IBM_Plex_Sans_Arabic, Instrument_Serif } from 'next/font/google';

/**
 * Typefaces.
 *
 * next/font downloads these at build time and serves them from our own origin —
 * no request ever goes to a font CDN at runtime, which also means no layout
 * shift and nothing to block on a slow connection in Lebanon.
 *
 * Two scripts, two pairs. Arabic is not a fallback appended to a Latin stack:
 * Amiri and IBM Plex Sans Arabic are the Arabic faces, chosen to sit at
 * comparable weight and colour to their Latin counterparts.
 */

export const displayLatin = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  variable: '--font-display-latin',
  display: 'swap',
});

export const displayArabic = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-display-arabic',
  display: 'swap',
});

export const bodyLatin = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body-latin',
  display: 'swap',
});

export const bodyArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500'],
  variable: '--font-body-arabic',
  display: 'swap',
});

/** Every font variable, for the <html> class. */
export const fontVariables = [
  displayLatin.variable,
  displayArabic.variable,
  bodyLatin.variable,
  bodyArabic.variable,
].join(' ');
