import { Card, Stack, Text } from '@mantine/core';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { PageHeader } from '@/components/PageHeader';
import { IncomeSheet, type IncomeSheetGroup } from '@/components/income/IncomeSheet';
import { IncomeToolbar } from '@/components/income/IncomeToolbar';
import { ViewNav } from '@/components/ViewNav';
import { getReference } from '@/queries/core';
import { categorySelectData } from '@/components/tx-helpers';
import { todayISO } from '@/lib/dates';
import { fmtMoney, toNum } from '@/lib/money';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'Доходы' };

export const dynamic = 'force-dynamic';

export default async function IncomePage() {
  const today = todayISO();
  const year = today.slice(0, 4);
  const ref = await getReference(today);

  const matrixRes = await db.execute(sql`
    SELECT s.id, s.name, EXTRACT(MONTH FROM t.date)::int AS m, sum(t.amount) AS total
    FROM transactions t
    JOIN income_sources s ON s.id = t.income_source_id
    WHERE t.kind = 'income' AND t.date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}
    GROUP BY 1, 2, 3
  `);

  const cells = new Map<string, number>();
  const totals = new Map<number, number>();
  for (const r of matrixRes.rows as Array<{ id: number; name: string; m: number; total: string }>) {
    cells.set(`${r.id}:${r.m}`, toNum(r.total));
    totals.set(Number(r.id), (totals.get(Number(r.id)) ?? 0) + toNum(r.total));
  }
  const sourcesWithData = ref.incomeSources.filter((s) => totals.has(s.id));
  const yearTotal = [...totals.values()].reduce((s, v) => s + v, 0);
  const monthTotals = Array.from({ length: 12 }, (_, i) =>
    sourcesWithData.reduce((s, src) => s + (cells.get(`${src.id}:${i + 1}`) ?? 0), 0),
  );

  // источники группируются по категориям (типам)
  const SOURCE_TYPE_LABELS: Record<string, string> = {
    rent: 'Аренда',
    monthly_payment: 'Ежемесячный платёж',
    one_off: 'Разовые',
    interest_cashback: 'Проценты и кэшбек',
    cash_income: 'Наличные',
    compensation: 'Компенсации',
  };
  const typeGroups: IncomeSheetGroup[] = Object.keys(SOURCE_TYPE_LABELS)
    .map((type) => ({
      type,
      label: SOURCE_TYPE_LABELS[type],
      sources: sourcesWithData
        .filter((s) => s.type === type)
        .map((s) => ({
          id: s.id,
          name: s.name,
          total: totals.get(s.id) ?? 0,
          months: Array.from({ length: 13 }, (_, m) => (m ? (cells.get(`${s.id}:${m}`) ?? 0) : 0)),
        })),
    }))
    .filter((g) => g.sources.length > 0);

  const checkingId = ref.accounts.find((a) => a.type === 'checking')?.id ?? null;
  const compensationSource = ref.incomeSources.find((s) => s.type === 'compensation') ?? null;

  return (
    <Stack gap="md">
      <PageHeader
        title="Доходы"
        beside={
          <ViewNav
            value="sheet"
            options={[
              { value: 'sheet', label: 'Таблица', href: '/income' },
              { value: 'list', label: 'Список', href: '/income/list' },
            ]}
          />
        }
        subtitle={`${year}: ${fmtMoney(yearTotal)}`}
        right={
          <IncomeToolbar
            sources={ref.incomeSources.map((s) => ({ id: s.id, name: s.name }))}
            accounts={ref.accounts
              .filter((a) => ['checking', 'cash'].includes(a.type))
              .map((a) => ({ id: a.id, name: a.name }))}
            defaultAccountId={checkingId}
            categories={categorySelectData(ref.groups, ref.categories)}
            compensationSourceId={compensationSource?.id ?? null}
          />
        }
      />
      {sourcesWithData.length > 0 ? (
        <IncomeSheet groups={typeGroups} monthTotals={monthTotals} yearTotal={yearTotal} year={year} />
      ) : (
        <Card>
          <Text c="dimmed">Доходов в этом году пока нет.</Text>
        </Card>
      )}
      <WipeButton scope={{ scope: 'income' }} label="все записи доходов" />
    </Stack>
  );
}
