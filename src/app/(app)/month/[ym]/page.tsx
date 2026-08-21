import { notFound } from 'next/navigation';
import { Group, Stack, Title } from '@mantine/core';
import { isValidYM, todayISO, ymOf, ymTitle } from '@/lib/dates';
import { getMonthTransactions } from '@/queries/core';
import { getMonthSheet } from '@/queries/month';
import { MonthView } from '@/components/month/MonthView';
import { MonthSwitcher } from '@/components/month/MonthSwitcher';

export const dynamic = 'force-dynamic';

export default async function MonthPage({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  if (!isValidYM(ym)) notFound();
  const today = todayISO();

  const [sheet, txs] = await Promise.all([getMonthSheet(ym), getMonthTransactions(ym)]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Title order={1} tt="capitalize">
          {ymTitle(ym)}
        </Title>
        <MonthSwitcher ym={ym} currentYm={ymOf(today)} />
      </Group>
      <MonthView ym={ym} sheet={sheet} txs={txs} today={today} />
    </Stack>
  );
}
