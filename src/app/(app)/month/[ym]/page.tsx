import { notFound } from 'next/navigation';
import { Group, Stack, Text, Title } from '@mantine/core';
import { isValidYM, todayISO, ymOf, ymTitle } from '@/lib/dates';
import { getMonthTotals, getMonthTransactions } from '@/queries/core';
import { getMonthMatrices } from '@/queries/month';
import { MonthView } from '@/components/month/MonthView';
import { MonthSwitcher } from '@/components/month/MonthSwitcher';
import { fmtMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function MonthPage({
  params,
  searchParams,
}: {
  params: Promise<{ ym: string }>;
  searchParams: Promise<{ method?: string }>;
}) {
  const { ym } = await params;
  const { method } = await searchParams;
  if (!isValidYM(ym)) notFound();
  const today = todayISO();

  const [{ actual, accrued }, txs, totals] = await Promise.all([
    getMonthMatrices(ym),
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
      <MonthView
        ym={ym}
        actual={actual}
        accrued={accrued}
        txs={txs}
        today={today}
        initialMethod={method === 'accrued' ? 'accrued' : 'actual'}
      />
    </Stack>
  );
}
