import { Suspense } from 'react';
import { Group, SimpleGrid, Stack, Title } from '@mantine/core';
import { todayISO, ymOf } from '@/lib/dates';
import { AnalyticsNav } from '@/components/analytics/AnalyticsNav';
import {
  FillWidget,
  SavingsNextWidget,
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
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Suspense fallback={<WidgetSkeleton lines={4} />}>
          <SavingsNextWidget />
        </Suspense>
      </SimpleGrid>
      <Suspense fallback={<WidgetSkeleton chart={90} lines={4} />}>
        <FillWidget />
      </Suspense>
    </Stack>
  );
}
