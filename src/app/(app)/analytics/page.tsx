import { Suspense } from 'react';
import { Group, Stack, Title } from '@mantine/core';
import { todayISO, ymOf } from '@/lib/dates';
import { AnalyticsNav } from '@/components/analytics/AnalyticsNav';
import {
  FillWidget,
  TrendWidget,
  WidgetSkeleton,
} from '@/components/analytics/widgets';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Аналитика · тренды' };

export default function AnalyticsTrendsPage() {
  const ym = ymOf(todayISO());

  return (
    <Stack gap="md">
      <Group gap="md" align="center" wrap="wrap">
        <Title order={1}>Аналитика</Title>
        <AnalyticsNav tab="trends" ym={ym} />
      </Group>

      <Suspense fallback={<WidgetSkeleton chart={240} lines={0} />}>
        <TrendWidget ym={ym} />
      </Suspense>
      {/* «Сбережения в …» (SavingsNextWidget) временно скрыт по просьбе Виктории —
          виджет и запрос оставлены, вернуть можно одной вставкой сюда. */}
      <Suspense fallback={<WidgetSkeleton chart={90} lines={4} />}>
        <FillWidget />
      </Suspense>
    </Stack>
  );
}
