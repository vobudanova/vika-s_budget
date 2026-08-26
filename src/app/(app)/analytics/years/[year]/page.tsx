import { notFound } from 'next/navigation';
import { Group, Stack, Title } from '@mantine/core';
import { todayISO, ymOf } from '@/lib/dates';
import { AnalyticsNav } from '@/components/analytics/AnalyticsNav';
import { YearCumulativeView } from '@/components/analytics/YearCumulativeView';
import { getYearCumulative } from '@/queries/analytics-widgets';
import { AnchorLink } from '@/components/links';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  return { title: `Аналитика · ${year}` };
}

export default async function AnalyticsYearPage({ params }: { params: Promise<{ year: string }> }) {
  const { year } = await params;
  if (!/^\d{4}$/.test(year)) notFound();
  const ym = ymOf(todayISO());
  const data = await getYearCumulative(Number(year));

  return (
    <Stack gap="md">
      <Group gap="md" align="center" wrap="wrap">
        <Title order={1}>Аналитика</Title>
        <AnalyticsNav tab="years" ym={ym} />
        <Group gap="xs" wrap="nowrap">
          <AnchorLink href={`/analytics/years/${Number(year) - 1}`} fz="sm">
            ← {Number(year) - 1}
          </AnchorLink>
          <AnchorLink href={`/analytics/years/${Number(year) + 1}`} fz="sm">
            {Number(year) + 1} →
          </AnchorLink>
        </Group>
      </Group>
      <YearCumulativeView data={data} />
    </Stack>
  );
}
