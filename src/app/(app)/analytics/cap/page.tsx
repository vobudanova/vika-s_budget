import { Suspense } from 'react';
import { Group, Stack, Title } from '@mantine/core';
import { todayISO, ymOf } from '@/lib/dates';
import { AnalyticsNav } from '@/components/analytics/AnalyticsNav';
import { CapMonthsWidget, WidgetSkeleton } from '@/components/analytics/widgets';

export const metadata = { title: 'Аналитика · КАП' };

export const dynamic = 'force-dynamic';

export default function AnalyticsCapPage() {
  const ym = ymOf(todayISO());
  return (
    <Stack gap="md">
      <Group gap="md" align="center" wrap="wrap">
        <Title order={1}>Аналитика</Title>
        <AnalyticsNav tab="cap" ym={ym} />
      </Group>
      <Suspense fallback={<WidgetSkeleton lines={10} />}>
        <CapMonthsWidget />
      </Suspense>
    </Stack>
  );
}
