import { notFound } from 'next/navigation';
import { Group, Stack, Text, Title } from '@mantine/core';
import { isValidYM, todayISO, ymOf, ymTitle } from '@/lib/dates';
import { getMonthTotals, getMonthTransactions } from '@/queries/core';
import { getMonthSheet } from '@/queries/month';
import { MonthView } from '@/components/month/MonthView';
import { MonthSwitcher } from '@/components/month/MonthSwitcher';
import { fmtMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function MonthPage({ params }: { params: Promise<{ ym: string }> }) {
  const { ym } = await params;
  if (!isValidYM(ym)) notFound();
  const today = todayISO();

  const [sheet, txs, totals] = await Promise.all([
    getMonthSheet(ym),
    getMonthTransactions(ym),
    getMonthTotals(ym),
  ]);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Stack gap={2}>
          <Title order={1} tt="capitalize">
            {ymTitle(ym)}
          </Title>
          <Text c="dimmed" fz="sm">
            Доходы {fmtMoney(totals.income)} · сбережения {fmtMoney(totals.savings)}
            {totals.ksReimbursed !== 0 && ` · из КС ${fmtMoney(Math.abs(totals.ksReimbursed))}`}
            {totals.covered !== 0 && ` · теневые ${fmtMoney(totals.covered)}`}
          </Text>
        </Stack>
        <MonthSwitcher ym={ym} currentYm={ymOf(today)} />
      </Group>
      <MonthView ym={ym} sheet={sheet} txs={txs} today={today} />
    </Stack>
  );
}
