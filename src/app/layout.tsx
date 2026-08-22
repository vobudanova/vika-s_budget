import type { Metadata, Viewport } from 'next';
import { Golos_Text } from 'next/font/google';
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './globals.css';

import { Providers } from './providers';

const golos = Golos_Text({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-golos',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Вика.Salmon', template: '%s — Вика.Salmon' },
  description: 'Личные финансы: траты, амортизация, КАП и фонд КС',
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    title: 'Вика.Salmon',
    statusBarStyle: 'default',
  },
  other: {
    // legacy-тег для старых iOS (новый Next выдаёт только mobile-web-app-capable)
    'apple-mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // standalone: без pinch-to-zoom (утилитарный инструмент)
  maximumScale: 1,
  userScalable: false,
  // без cover iOS отдаёт env(safe-area-inset-*) = 0 — отступы не работают
  viewportFit: 'cover',
  themeColor: '#faf7f5',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" {...mantineHtmlProps} className={`${golos.variable}`}>
      <head>
        <ColorSchemeScript forceColorScheme="light" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
