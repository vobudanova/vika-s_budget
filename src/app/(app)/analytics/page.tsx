import { Suspense } from 'react';
import { Group, SimpleGrid, Stack, Title } from '@mantine/core';
import { todayISO, ymOf } from '@/lib/dates';
import { AnalyticsNav } from '@/components/analytics/AnalyticsNav';
import {
  CapMonthsWidget,
  FillWidget,
  ForecastWidget,
  FundsWidget,
  InflationWidget,
  RhythmWidget,
  ThingsWidget,
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
        <Suspense fallback={<WidgetSkeleton lines={5} />}>
          <ForecastWidget ym={ym} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton lines={5} />}>
          <FundsWidget ym={ym} />
        </Suspense>
      </SimpleGrid>
      <Suspense
        fallback={
          <>
            <WidgetSkeleton chart={100} lines={1} />
            <WidgetSkeleton chart={150} lines={4} />
          </>
        }
      >
        <RhythmWidget ym={ym} />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton chart={90} lines={4} />}>
        <FillWidget />
      </Suspense>
      <Suspense fallback={<WidgetSkeleton lines={8} />}>
        <CapMonthsWidget />
      </Suspense>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Suspense fallback={<WidgetSkeleton chart={130} lines={4} />}>
          <ThingsWidget ym={ym} />
        </Suspense>
        <Suspense fallback={<WidgetSkeleton chart={200} lines={2} />}>
          <InflationWidget ym={ym} />
        </Suspense>
      </SimpleGrid>
    </Stack>
  );
}
