import {
  Card,
  Group,
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
import { PageHeader } from '@/components/PageHeader';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { CapGoalRow } from '@/components/cap/CapGoalRow';
import { AllocationsValue } from '@/components/cap/CapReconcile';
import { CapMonthlyTable } from '@/components/cap/CapMonthlyTable';
import { SpentLeftover } from '@/components/cap/SpentLeftover';
import { CapPaymentButton } from '@/components/cap/CapPaymentButton';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { getCapOverview, type CapGoalOverview } from '@/queries/cap';
import { getReference } from '@/queries/core';
import { RU_MONTHS, todayISO, ymAdd, ymOf, ymTitle } from '@/lib/dates';
import { fmtMoneyExact, toNum } from '@/lib/money';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'КАП' };

export const dynamic = 'force-dynamic';

export default async function CapPage() {
  const today = todayISO();
  const currentYm = ymOf(today);
  const [cap, ref] = await Promise.all([getCapOverview(), getReference()]);

  const activeGoals = cap.goals.filter((g) => g.status !== 'spent');
  const spentGoals = cap.goals
    .filter((g) => g.status === 'spent')
    .sort((a, b) => (a.spentAt ?? '').localeCompare(b.spentAt ?? ''));
  const openGoalsForTransfer = cap.goals
    .filter((g) => g.status !== 'spent' && g.remaining > 0)
    .map((g) => ({ id: g.id, name: g.name, remaining: g.remaining }));
  const moneyAccounts = ref.accounts
    .filter((a) => ['checking', 'cash'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name }));
  const checkingId = ref.accounts.find((a) => a.type === 'checking')?.id ?? null;

  // цели по категориям активов, внутри — по дате начала амортизации;
  // порядок групп — как в справочнике категорий вещей (sort_order)
  const byCategory = new Map<string, CapGoalOverview[]>();
  for (const c of ref.assetCategories) byCategory.set(c.name, []);
  for (const g of activeGoals) {
    const key = g.assetCategoryName ?? 'Без категории';
    byCategory.set(key, [...(byCategory.get(key) ?? []), g]);
  }
  for (const [key, list] of byCategory) {
    if (list.length === 0) byCategory.delete(key);
    else list.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }

  // переводы на счёт КАП по месяцам — сверка с таблицей месяца
  const trRes = await db.execute(sql`
    SELECT to_char(date_trunc('month', t.date), 'YYYY-MM') AS ym, sum(t.amount) AS s
    FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
    WHERE t.kind = 'transfer' AND ca.type = 'savings_cap'
    GROUP BY 1
  `);
  const monthTransfers: Record<string, number> = {};
  for (const r of trRes.rows as Array<{ ym: string; s: string }>) {
    monthTransfers[String(r.ym)] = toNum(r.s);
  }

  // «Взносы по месяцам»: факт (флажки + перетоки) и план (КАП/мес) по категориям
  const monthCats = [...byCategory.keys()];
  const allYms = new Set<string>();
  for (const g of cap.goals) for (const ym of Object.keys(g.monthsFlags)) allYms.add(ym);
  const startYmOf = (g: CapGoalOverview) =>
    (g.startDate ? ymOf(g.startDate) : null) ?? g.firstOwnYm ?? currentYm;
  for (const g of cap.goals) allYms.add(startYmOf(g));
  const ymsSorted = [...allYms].sort();
  const firstYm = ymsSorted[0] ?? currentYm;
  const monthCols: { ym: string; label: string }[] = [];
  for (let ym = firstYm; ym <= currentYm; ym = ymAdd(ym, 1)) {
    monthCols.push({
      ym,
      label: `${RU_MONTHS[Number(ym.slice(5, 7)) - 1].slice(0, 3).toLowerCase()} ’${ym.slice(2, 4)}`,
    });
  }
  const monthCells: Record<string, { fact: number; plan: number }> = {};
  for (const g of cap.goals) {
    const cat = g.assetCategoryName ?? 'Без категории';
    const start = startYmOf(g);
    const endYm = ymAdd(start, g.termMonths - 1);
    const spentYm = g.spentAt ? ymOf(g.spentAt) : null;
    for (const c of monthCols) {
      const key = `${cat}:${c.ym}`;
      const cell = monthCells[key] ?? { fact: 0, plan: 0 };
      const flag = g.monthsFlags[c.ym];
      if (flag) cell.fact += flag.amount + flag.inflow;
      if (c.ym >= start && c.ym <= endYm && (!spentYm || c.ym <= spentYm)) cell.plan += g.monthly;
      monthCells[key] = cell;
    }
  }

  return (
    <Stack gap="md" className="cap-page">
      <PageHeader
        title="КАП"
        subtitle={fmtMoneyExact(cap.ledgerTotal)}
        right={
          <CapPaymentButton
            pending={cap.pendingPayment}
            total={cap.pendingTotal}
            accounts={moneyAccounts}
            defaultAccountId={checkingId}
          />
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>Сверка</CardLabel>
            <Table verticalSpacing={4} fz="sm">
              <TableTbody>
                <TableTr>
                  <TableTd px={0}>Отложено</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={cap.ledgerTotal} fz="sm" exact />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Счёт КАП</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={cap.capAccountsBalance} fz="sm" exact />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Размещения фонда (доллары, вклады…)</TableTd>
                  <TableTd px={0}>
                    <AllocationsValue value={cap.allocationsNet} />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>
                    <Text fw={700} fz="sm">
                      Расхождение
                    </Text>
                  </TableTd>
                  <TableTd px={0} ta="right">
                    <Money
                      value={cap.reconciliationDiff}
                      exact
                      fw={700}
                      fz="sm"
                      c={Math.abs(cap.reconciliationDiff) < 0.01 ? 'ink.7' : 'red.8'}
                    />
                    {Math.abs(cap.reconciliationDiff) < 0.01 && (
                      <Text span c="ink.7" fz="sm">
                        {' '}
                        ✓
                      </Text>
                    )}
                  </TableTd>
                </TableTr>
              </TableTbody>
            </Table>
          </Stack>
        </Card>
      </SimpleGrid>

      {activeGoals.length === 0 && (
        <Card>
          <Text c="dimmed">Целей пока нет.</Text>
        </Card>
      )}

      {[...byCategory.entries()].map(([cat, goals]) => (
        // overflow clip вместо дефолтного hidden карточки: hidden создаёт
        // скролл-контейнер и не даёт заголовку группы прилипать
        <Card key={cat} p={0} style={{ overflow: 'clip' }}>
          <div className="group-head">
            <Group px="md" h={48} justify="space-between" wrap="nowrap" className="group-head-inner">
              <Text fw={600}>{cat}</Text>
              <Text fz="sm" c="dimmed" className="money">
                {fmtMoneyExact(goals.reduce((s, g) => s + g.contributed, 0))}
              </Text>
            </Group>
          </div>
          <div className="group-scroll">
            {/* фиксированная раскладка: ширины колонок одинаковы во всех группах,
                гибкая только «Цель» (забирает остаток) */}
            <Table miw={1200} verticalSpacing={6} horizontalSpacing={12} fz="sm" style={{ tableLayout: 'fixed' }}>
              <TableThead>
                <TableTr>
                  <TableTh ta="center">Цель</TableTh>
                  <TableTh ta="center" w={100}>КАП/мес</TableTh>
                  <TableTh ta="center" w={125}>Отложено</TableTh>
                  <TableTh ta="center" w={125}>Остаток</TableTh>
                  <TableTh ta="center" w={125}>Цель, ₽</TableTh>
                  <TableTh ta="center" w={140}>Статус</TableTh>
                  <TableTh ta="center" w={366}>Флажки</TableTh>
                </TableTr>
              </TableThead>
              <TableTbody>
                {goals.map((g) => (
                  <CapGoalRow
                    key={g.id}
                    goal={g}
                    currentYm={currentYm}
                    otherGoals={openGoalsForTransfer.filter((o) => o.id !== g.id)}
                    returnAccounts={moneyAccounts}
                  />
                ))}
              </TableTbody>
            </Table>
          </div>
        </Card>
      ))}

      {spentGoals.length > 0 && (
        <Card>
          <Stack gap="xs">
            <CardLabel>Завершено</CardLabel>
            {spentGoals.map((g) => (
              <Group key={g.id} justify="space-between" wrap="wrap" gap="xs">
                <Text fz="sm" c="dimmed">
                  {g.name}
                </Text>
                <Group gap="md" wrap="nowrap">
                  {g.contributed > 0.005 && (
                    <SpentLeftover
                      goal={g}
                      otherGoals={openGoalsForTransfer.filter((o) => o.id !== g.id)}
                      returnAccounts={moneyAccounts}
                    />
                  )}
                  <Text fz="sm" c="dimmed" className="money">
                    {fmtMoneyExact(g.target)} · {ymTitle(ymOf(g.spentAt ?? today))}
                  </Text>
                </Group>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
      <CapMonthlyTable columns={monthCols} categories={monthCats} cells={monthCells} transfers={monthTransfers} />
      <WipeButton scope={{ scope: 'cap' }} label="все цели КАП и их движения" />
    </Stack>
  );
}
