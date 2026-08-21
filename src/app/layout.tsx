import type { Metadata, Viewport } from 'next';
import { Golos_Text, JetBrains_Mono } from 'next/font/google';
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

const jbMono = JetBrains_Mono({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Вика.Финансы', template: '%s — Вика.Финансы' },
  description: 'Личные финансы: траты, амортизация, КАП и фонд КС',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f6f8f6',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" {...mantineHtmlProps} className={`${golos.variable} ${jbMono.variable}`}>
      <head>
        <ColorSchemeScript forceColorScheme="light" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
