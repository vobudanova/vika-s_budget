import type { Metadata, Viewport } from 'next';
import { Golos_Text, JetBrains_Mono } from 'next/font/google';
import { ColorSchemeScript, MantineProvider, mantineHtmlProps } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { DatesProvider } from '@mantine/dates';
import 'dayjs/locale/ru';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import './globals.css';

import { theme } from './theme';

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
        <MantineProvider theme={theme} forceColorScheme="light">
          <DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1 }}>
            <Notifications position="top-right" autoClose={3500} />
            {children}
          </DatesProvider>
        </MantineProvider>
      </body>
    </html>
  );
}
