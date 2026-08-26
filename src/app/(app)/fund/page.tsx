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
import { ViewNav } from '@/components/ViewNav';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { FundMovementsList } from '@/components/fund/FundActions';
import { FundSheet } from '@/components/fund/FundSheet';
import { getFundOverview } from '@/queries/fund';
import { getReference, getSetting } from '@/queries/core';
import { todayISO } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'КС' };

export const dynamic = 'force-dynamic';

export default async function FundPage() {
  const year = todayISO().slice(0, 4);
  const [fund, ref, closedMonths] = await Promise.all([
    getFundOverview(year),
    getReference(),
    getSetting<string[]>('fund_closed_months', []),
  ]);
  const groups = [...new Set(fund.categories.map((c) => c.groupName))];
  const moneyAccounts = ref.accounts
    .filter((a) => ['checking', 'cash'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <Stack gap="md">
      <PageHeader
        title="КС"
        beside={
          <ViewNav
            value="sheet"
            options={[
              { value: 'sheet', label: 'Таблица', href: '/fund' },
              { value: 'moves', label: 'Движения', href: '/fund/moves' },
            ]}
          />
        }
        subtitle={
          <>
            Краткосрочные сбережения · остаток {fmtMoney(fund.totalBalance)} · план{' '}
            {fmtMoney(fund.planTotal)}/мес
          </>
        }
      />

      {fund.pendingOffsetsTotal > 0 && (
        <Alert color="orange" variant="light" radius="lg">
          Незачтённых компенсаций на {fmtMoney(fund.pendingOffsetsTotal)} — следующее пополнение
          составит {fmtMoney(fund.nextTopupAmount)} вместо {fmtMoney(fund.planTotal)}.
        </Alert>
      )}

      <FundSheet categories={fund.categories} year={year} closedMonths={closedMonths} />

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
      <WipeButton scope={{ scope: 'fund' }} label="все движения фонда КС и компенсации" />
    </Stack>
  );
}
