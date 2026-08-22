import {
  Card,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from '@mantine/core';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { PageHeader } from '@/components/PageHeader';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { TxList } from '@/components/TxList';
import { CompensationForm, IncomeForm } from '@/components/income/IncomeForms';
import { getReference, getTransactions } from '@/queries/core';
import { categorySelectData } from '@/components/tx-helpers';
import { todayISO, RU_MONTHS } from '@/lib/dates';
import { fmtMoney, toNum } from '@/lib/money';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'Доходы' };

export const dynamic = 'force-dynamic';

export default async function IncomePage() {
  const today = todayISO();
  const year = today.slice(0, 4);
  const ref = await getReference(today);

  const [matrixRes, recent] = await Promise.all([
    db.execute(sql`
      SELECT s.id, s.name, EXTRACT(MONTH FROM t.date)::int AS m, sum(t.amount) AS total
      FROM transactions t
      JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.kind = 'income' AND t.date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}
      GROUP BY 1, 2, 3
    `),
    getTransactions(sql`t.kind IN ('income', 'coverage_in') AND t.date >= ${`${year}-01-01`}`),
  ]);

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

  const checkingId = ref.accounts.find((a) => a.type === 'checking')?.id ?? null;
  const compensationSource = ref.incomeSources.find((s) => s.type === 'compensation') ?? null;

  return (
    <Stack gap="md">
      <PageHeader
        title="Доходы"
        subtitle={
          <>
            {year}: {fmtMoney(yearTotal)} — доходы попадают в балансы счетов автоматически
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <IncomeForm
          sources={ref.incomeSources.map((s) => ({ id: s.id, name: s.name }))}
          accounts={ref.accounts
            .filter((a) => ['checking', 'cash'].includes(a.type))
            .map((a) => ({ id: a.id, name: a.name }))}
          defaultAccountId={checkingId}
        />
        <CompensationForm
          categories={categorySelectData(ref.groups, ref.categories)}
          accounts={ref.accounts
            .filter((a) => ['checking', 'cash'].includes(a.type))
            .map((a) => ({ id: a.id, name: a.name }))}
          compensationSourceId={compensationSource?.id ?? null}
          defaultAccountId={checkingId}
        />
      </SimpleGrid>

      {sourcesWithData.length > 0 && (
        <Card p={0}>
          <Stack gap={0}>
            <Text fw={600} px="md" py="sm">
              По источникам · {year}
            </Text>
            <ScrollArea type="auto" offsetScrollbars>
              <Table miw={980} fz={13} verticalSpacing={8} horizontalSpacing={12} withColumnBorders className="sheet">
                <TableThead>
                  <TableTr>
                    <TableTh style={{ minWidth: 170 }}>Источник</TableTh>
                    <TableTh ta="right">Σ год</TableTh>
                    {RU_MONTHS.map((m) => (
                      <TableTh key={m} ta="right">
                        {m.slice(0, 3)}
                      </TableTh>
                    ))}
                  </TableTr>
                </TableThead>
                <TableTbody>
                  {sourcesWithData.map((s) => (
                    <TableTr key={s.id}>
                      <TableTd>{s.name}</TableTd>
                      <TableTd ta="right" className="money" fw={600}>
                        {fmtMoney(totals.get(s.id) ?? 0)}
                      </TableTd>
                      {Array.from({ length: 12 }, (_, i) => (
                        <TableTd key={i} ta="right" className="money">
                          {cells.get(`${s.id}:${i + 1}`)
                            ? fmtMoney(cells.get(`${s.id}:${i + 1}`)!)
                            : ''}
                        </TableTd>
                      ))}
                    </TableTr>
                  ))}
                  <TableTr style={{ borderTop: '2px solid var(--ink-line)' }}>
                    <TableTd>
                      <Text fw={700} fz="xs">
                        Итого
                      </Text>
                    </TableTd>
                    <TableTd ta="right" className="money" fw={700}>
                      {fmtMoney(yearTotal)}
                    </TableTd>
                    {monthTotals.map((t, i) => (
                      <TableTd key={i} ta="right" className="money">
                        {t ? fmtMoney(t) : ''}
                      </TableTd>
                    ))}
                  </TableTr>
                </TableTbody>
              </Table>
            </ScrollArea>
          </Stack>
        </Card>
      )}

      <Card>
        <Stack gap="sm">
          <CardLabel>Последние поступления</CardLabel>
          <TxList items={recent.slice(0, 15)} showDate emptyText="Доходов в этом году пока нет" />
        </Stack>
      </Card>
      <WipeButton scope={{ scope: 'income' }} label="все записи доходов" />
    </Stack>
  );
}
