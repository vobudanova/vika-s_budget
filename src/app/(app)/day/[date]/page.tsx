import { notFound } from 'next/navigation';
import { Group, Stack, Text, Title } from '@mantine/core';
import { dateTitleFull, isValidISODate, todayISO, RU_MONTHS_GEN } from '@/lib/dates';
import { getDayTransactions, getReference, getSetting } from '@/queries/core';
import { isFilledDay } from '@/actions/misc';
import { DayWorkspace } from '@/components/day/DayWorkspace';
import { DateSwitcher } from '@/components/day/DateSwitcher';
import { FilledDayToggle } from '@/components/day/FilledDayToggle';
import { Money } from '@/components/Money';
import { categorySelectData } from '@/components/tx-helpers';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidISODate(date)) return { title: 'День' };
  const [y, m, d] = date.split('-').map(Number);
  return { title: `${d} ${RU_MONTHS_GEN[m - 1]} ${y}` };
}

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!isValidISODate(date)) notFound();

  const [txs, ref, inflationRate, filled] = await Promise.all([
    getDayTransactions(date),
    getReference(date),
    getSetting<number>('cap_inflation_rate', 1.1),
    isFilledDay(date),
  ]);

  const daySpent = txs
    .filter((t) => ['expense', 'purchase'].includes(t.kind) && !t.covered)
    .reduce((s, t) => s + t.amount, 0);

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <Stack gap={2}>
          <Title order={1}>Новый день</Title>
          <Text c="dimmed" fz="sm">
            {dateTitleFull(date)}
            {daySpent !== 0 && (
              <>
                {' · потрачено '}
                <Money value={daySpent} fz="sm" />
              </>
            )}
          </Text>
        </Stack>
        <Group gap="md" wrap="wrap">
          <FilledDayToggle date={date} initial={filled} />
          <DateSwitcher date={date} base="/day" today={todayISO()} />
        </Group>
      </Group>
      <DayWorkspace
        date={date}
        txs={txs}
        categories={categorySelectData(ref.groups, ref.categories)}
        accounts={ref.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type }))}
        fundCategories={ref.fundCategories.map((f) => ({
          id: f.id,
          name: f.name,
          groupName: f.groupName,
        }))}
        assetCategories={ref.assetCategories.map((c) => ({ id: c.id, name: c.name }))}
        inflationRate={inflationRate}
      />
    </Stack>
  );
}
