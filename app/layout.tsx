import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { PRODUCT_NAME, TAGLINE } from '@/lib/brand';
import './globals.css';

/**
 * Application typography.
 *
 * `next/font` downloads at BUILD time and self-hosts the result, so there is no
 * runtime request to Google and no layout shift from a late webfont.
 * `display: 'swap'` keeps first paint readable if the font is still decoding.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

/** Reserved for correlation IDs, versions and chunk identifiers. */
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-inter',
  weight: ['400', '500'],
});

/**
 * Editorial display face, reserved for the landing page's giant "Islanda"
 * hero wordmark (`--font-display` in globals.css). Inter carries every other
 * heading in the product; this exists only because a wordmark occupying a
 * third of the viewport needs more character than a UI grotesk provides at
 * that scale. Not used anywhere in the authenticated application.
 */
const bricolageGrotesque = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: `${PRODUCT_NAME} — ${TAGLINE}`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    'Islanda helps businesses understand their context, turn fragmented information into intelligence, and navigate what comes next.',
  openGraph: {
    title: `${PRODUCT_NAME} — ${TAGLINE}`,
    description:
      'Islanda helps businesses understand their context, turn fragmented information into intelligence, and navigate what comes next.',
    siteName: PRODUCT_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${PRODUCT_NAME} — ${TAGLINE}`,
    description:
      'Islanda helps businesses understand their context, turn fragmented information into intelligence, and navigate what comes next.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${bricolageGrotesque.variable}`}
    >
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
