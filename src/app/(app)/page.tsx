import {
  Card,
  Divider,
  Group,
  SimpleGrid,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTr,
  Text,
  Title,
} from '@mantine/core';
import { AnchorLink, ButtonLink } from '@/components/links';
import { todayISO, ymOf, dateTitleFull, dateTitle, ymTitle } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
import {
  getAccountBalances,
  getDayTransactions,
  getMonthTotals,
  getReference,
  splitBalances,
} from '@/queries/core';
import { Money } from '@/components/Money';
import { QuickExpense } from '@/components/QuickExpense';
import { TxList } from '@/components/TxList';
import { categorySelectData } from '@/components/tx-helpers';
import { CardLabel } from '@/components/CardLabel';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const today = todayISO();
  const ym = ymOf(today);
  const [balances, totals, dayTxs, ref] = await Promise.all([
    getAccountBalances(),
    getMonthTotals(ym),
    getDayTransactions(today),
    getReference(today),
  ]);
  const { totalRub, totalUsd } = splitBalances(balances);
  const cats = categorySelectData(ref.groups, ref.categories);
  const defaultAccount = ref.accounts.find((a) => a.type === 'checking') ?? null;
  const mainAccounts = balances.filter((b) =>
    ['checking', 'credit_card', 'savings_cap', 'savings_ks', 'cash'].includes(b.type),
  );
  const otherTotal = balances
    .filter((b) => !mainAccounts.includes(b) && b.currency === 'RUB' && b.includeInTotal)
    .reduce((s, b) => s + b.balance, 0);

  return (
    <Stack gap="lg">
      <Stack gap={2}>
        <Title order={1}>Привет, Виктория!</Title>
        <Text c="dimmed" fz="sm">
          {dateTitleFull(today)}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>На счетах сейчас</CardLabel>
            <Group align="baseline" gap="xs">
              <Money value={totalRub} fz={30} fw={600} />
              {totalUsd > 0 && (
                <Text c="dimmed" fz="sm" className="money">
                  + {fmtMoney(totalUsd, 'USD')}
                </Text>
              )}
            </Group>
            <Table>
              <TableTbody>
                {mainAccounts.map((b) => (
                  <TableTr key={b.accountId}>
                    <TableTd px={0}>
                      <Text fz="sm">{b.name}</Text>
                    </TableTd>
                    <TableTd px={0} ta="right">
                      <Money value={b.balance} currency={b.currency} fz="sm" />
                    </TableTd>
                  </TableTr>
                ))}
                {otherTotal !== 0 && (
                  <TableTr>
                    <TableTd px={0}>
                      <Text fz="sm" c="dimmed">
                        Вклады, металлы, фондовый рынок
                      </Text>
                    </TableTd>
                    <TableTd px={0} ta="right">
                      <Money value={otherTotal} fz="sm" c="dimmed" />
                    </TableTd>
                  </TableTr>
                )}
              </TableTbody>
            </Table>
            <AnchorLink href="/accounts" fz="sm">
              Счета и сверка →
            </AnchorLink>
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <CardLabel>Новый день · {dateTitle(today)}</CardLabel>
              <ButtonLink href={`/day/${today}`} variant="light" size="compact-sm">
                Вся страница →
              </ButtonLink>
            </Group>
            <QuickExpense
              date={today}
              categories={cats}
              defaultAccountId={defaultAccount?.id ?? null}
              compact
            />
            <Divider />
            <TxList items={dayTxs.slice(0, 6)} emptyText="Сегодня операций ещё не было" />
          </Stack>
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        <Card>
          <Stack gap={4}>
            <CardLabel>{ymTitle(ym)} · фактические</CardLabel>
            <Money value={totals.actual + totals.trips} fz={24} fw={600} />
            <Text fz="xs" c="dimmed">
              покупки целиком{totals.trips > 0 ? ` · поездки ${fmtMoney(totals.trips)}` : ''}
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>{ymTitle(ym)} · начисленные</CardLabel>
            <Money value={totals.accrued + totals.trips} fz={24} fw={600} />
            <Text fz="xs" c="dimmed">
              с амортизацией {fmtMoney(totals.amortization)}
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>{ymTitle(ym)} · доходы</CardLabel>
            <Money value={totals.income} fz={24} fw={600} c={totals.income > 0 ? 'ink.7' : undefined} />
            <Text fz="xs" c="dimmed">
              {totals.ksReimbursed !== 0
                ? `компенсировано из КС ${fmtMoney(Math.abs(totals.ksReimbursed))}`
                : 'за месяц'}
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
