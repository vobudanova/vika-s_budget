import {
  Alert,
  Card,
  Group,
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
import { PageHeader } from '@/components/PageHeader';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { FundMovementsList, FundToolbar } from '@/components/fund/FundActions';
import { getFundOverview } from '@/queries/fund';
import { getReference } from '@/queries/core';
import { todayISO } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function FundPage() {
  const year = todayISO().slice(0, 4);
  const [fund, ref] = await Promise.all([getFundOverview(year), getReference()]);
  const groups = [...new Set(fund.categories.map((c) => c.groupName))];
  const moneyAccounts = ref.accounts
    .filter((a) => ['checking', 'cash'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <Stack gap="md">
      <PageHeader
        title="Фонд КС"
        subtitle={
          <>
            Краткосрочные сбережения · остаток {fmtMoney(fund.totalBalance)} · план{' '}
            {fmtMoney(fund.planTotal)}/мес
          </>
        }
        right={
          <FundToolbar
            planTotal={fund.planTotal}
            offsetsTotal={fund.pendingOffsetsTotal}
            toTransfer={fund.nextTopupAmount}
            accounts={moneyAccounts}
            defaultAccountId={ref.accounts.find((a) => a.type === 'checking')?.id ?? null}
            fundCategories={ref.fundCategories.map((f) => ({
              id: f.id,
              name: f.name,
              groupName: f.groupName,
            }))}
          />
        }
      />

      {fund.pendingOffsetsTotal > 0 && (
        <Alert color="orange" variant="light" radius="lg">
          Незачтённых компенсаций на {fmtMoney(fund.pendingOffsetsTotal)} — следующее пополнение
          составит {fmtMoney(fund.nextTopupAmount)} вместо {fmtMoney(fund.planTotal)}.
        </Alert>
      )}

      <Card p={0}>
        <ScrollArea type="auto" offsetScrollbars>
          <Table miw={640} verticalSpacing={6} fz="sm">
            <TableThead>
              <TableTr>
                <TableTh>Статья</TableTh>
                <TableTh ta="right">План/мес</TableTh>
                <TableTh ta="right">Отложено {year}</TableTh>
                <TableTh ta="right">Израсходовано {year}</TableTh>
                <TableTh ta="right">Остаток</TableTh>
              </TableTr>
            </TableThead>
            <TableTbody>
              {groups.map((g) => {
                const rows = fund.categories.filter((c) => c.groupName === g);
                const sum = (f: (c: (typeof rows)[number]) => number) =>
                  rows.reduce((s, c) => s + f(c), 0);
                return [
                  <TableTr key={g} bg="var(--mantine-color-gray-0)">
                    <TableTd>
                      <Text fw={700} fz="sm">
                        {g}
                      </Text>
                    </TableTd>
                    <TableTd ta="right" className="money">
                      {fmtMoney(sum((c) => c.monthlyPlan))}
                    </TableTd>
                    <TableTd ta="right" className="money">
                      {fmtMoney(sum((c) => c.contributedYtd))}
                    </TableTd>
                    <TableTd ta="right" className="money">
                      {fmtMoney(sum((c) => c.spentYtd))}
                    </TableTd>
                    <TableTd ta="right">
                      <Money value={sum((c) => c.balance)} fw={700} fz="sm" />
                    </TableTd>
                  </TableTr>,
                  ...rows.map((c) => (
                    <TableTr key={c.id}>
                      <TableTd>
                        <Text fz="sm" pl={12}>
                          {c.name}
                        </Text>
                      </TableTd>
                      <TableTd ta="right" className="money" c="dimmed">
                        {c.monthlyPlan ? fmtMoney(c.monthlyPlan) : '—'}
                      </TableTd>
                      <TableTd ta="right" className="money">
                        {c.contributedYtd ? fmtMoney(c.contributedYtd) : ''}
                      </TableTd>
                      <TableTd ta="right" className="money">
                        {c.spentYtd ? fmtMoney(c.spentYtd) : ''}
                      </TableTd>
                      <TableTd ta="right">
                        <Money value={c.balance} fz="sm" c={c.balance < 0 ? 'red.8' : undefined} />
                      </TableTd>
                    </TableTr>
                  )),
                ];
              })}
              <TableTr style={{ borderTop: '2px solid var(--ink-line)' }}>
                <TableTd>
                  <Text fw={700}>Итого</Text>
                </TableTd>
                <TableTd ta="right" className="money" fw={700}>
                  {fmtMoney(fund.planTotal)}
                </TableTd>
                <TableTd />
                <TableTd />
                <TableTd ta="right">
                  <Money value={fund.totalBalance} fw={700} />
                </TableTd>
              </TableTr>
            </TableTbody>
          </Table>
        </ScrollArea>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>Сверка фонда КС</CardLabel>
            <Table verticalSpacing={4} fz="sm">
              <TableTbody>
                <TableTr>
                  <TableTd px={0}>Σ остатков статей</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={fund.totalBalance} fz="sm" />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Счёт КС</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={fund.ksAccountBalance} fz="sm" />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Размещения фонда</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={fund.allocationsNet} fz="sm" />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Зачёты «в пути»</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={-fund.pendingOffsetsTotal} fz="sm" />
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
                      value={fund.reconciliationDiff}
                      fw={700}
                      fz="sm"
                      c={Math.abs(fund.reconciliationDiff) < 0.01 ? 'ink.7' : 'red.8'}
                    />
                    {Math.abs(fund.reconciliationDiff) < 0.01 && (
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
        <Card>
          <Stack gap="sm">
            <CardLabel>Последние движения</CardLabel>
            <FundMovementsList movements={fund.recentMovements} />
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
