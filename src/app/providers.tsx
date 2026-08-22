'use client';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import { DatesProvider } from '@mantine/dates';
import 'dayjs/locale/ru';
import { theme } from './theme';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={theme} forceColorScheme="light">
      <DatesProvider settings={{ locale: 'ru', firstDayOfWeek: 1 }}>
        <ModalsProvider>
          <Notifications position="top-right" autoClose={3500} />
          {children}
        </ModalsProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
