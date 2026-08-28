import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Group, SimpleGrid, Stack, Title } from '@mantine/core';
import { isValidYM, todayISO, ymOf, ymTitle } from '@/lib/dates';
import { getAnalytics } from '@/queries/analytics';
import { AnalyticsView } from '@/components/analytics/AnalyticsView';
import { AnalyticsNav } from '@/components/analytics/AnalyticsNav';
import { CompareWidget, WidgetSkeleton } from '@/components/analytics/widgets';
import { MonthSwitcher } from '@/components/month/MonthSwitcher';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  if (!isValidYM(ym)) return { title: 'Аналитика' };
  return { title: `Аналитика · ${ymTitle(ym)}` };
}

export default async function AnalyticsMonthPage({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  if (!isValidYM(ym)) notFound();
  const a = await getAnalytics(ym);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="md" align="center" wrap="wrap">
          <Title order={1}>Аналитика</Title>
          <AnalyticsNav tab="month" ym={ym} />
        </Group>
        <MonthSwitcher ym={ym} currentYm={ymOf(todayISO())} base="/analytics" />
      </Group>

      <AnalyticsView a={a} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Suspense fallback={<WidgetSkeleton lines={6} />}>
          <CompareWidget ym={ym} />
        </Suspense>
      </SimpleGrid>
    </Stack>
  );
}
