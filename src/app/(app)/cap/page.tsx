import {
  Card,
  Group,
  SimpleGrid,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTr,
  Text,
} from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { CapGoalCard } from '@/components/cap/CapGoalCard';
import { CapPaymentCard } from '@/components/cap/CapPaymentCard';
import { getCapOverview } from '@/queries/cap';
import { getReference } from '@/queries/core';
import { todayISO, ymOf, ymTitle, RU_MONTHS_GEN } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function CapPage() {
  const today = todayISO();
  const currentYm = ymOf(today);
  const year = Number(today.slice(0, 4));
  const [cap, ref] = await Promise.all([getCapOverview(), getReference()]);

  const activeGoals = cap.goals.filter((g) => g.status !== 'spent');
  const spentGoals = cap.goals.filter((g) => g.status === 'spent');
  const openGoalsForTransfer = cap.goals
    .filter((g) => g.status !== 'spent' && g.remaining > 0)
    .map((g) => ({ id: g.id, name: g.name, remaining: g.remaining }));
  const moneyAccounts = ref.accounts
    .filter((a) => ['checking', 'cash'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name }));
  const checkingId = ref.accounts.find((a) => a.type === 'checking')?.id ?? null;

  return (
    <Stack gap="md">
      <PageHeader
        title="КАП"
        subtitle={
          <>
            Компенсационные амортизационные платежи · накоплено {fmtMoney(cap.ledgerTotal)} по{' '}
            {activeGoals.length} целям
          </>
        }
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <CapPaymentCard
          ym={currentYm}
          monthTitle={RU_MONTHS_GEN[Number(currentYm.slice(5, 7)) - 1]}
          pending={cap.pendingPayment}
          total={cap.pendingTotal}
          accounts={moneyAccounts}
          defaultAccountId={checkingId}
        />
        <Card>
          <Stack gap="sm">
            <CardLabel>Сверка КАП-фонда</CardLabel>
            <Table verticalSpacing={4} fz="sm">
              <TableTbody>
                <TableTr>
                  <TableTd px={0}>Σ леджера по всем целям</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={cap.ledgerTotal} fz="sm" />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Счёт КАП</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={cap.capAccountsBalance} fz="sm" />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Размещения фонда (доллары, вклады…)</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={cap.allocationsNet} fz="sm" />
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
            <Text fz="xs" c="dimmed">
              Деньги фонда, переведённые в другие инструменты с пометкой «размещение», продолжают
              числиться за КАП.
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      {activeGoals.length === 0 && (
        <Card>
          <Text c="dimmed">
            Целей пока нет. Они создаются автоматически при вводе покупки с галкой «Копить на
            замену».
          </Text>
        </Card>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {activeGoals.map((g) => (
          <CapGoalCard
            key={g.id}
            goal={g}
            year={year}
            currentYm={currentYm}
            otherGoals={openGoalsForTransfer.filter((o) => o.id !== g.id)}
            returnAccounts={moneyAccounts}
          />
        ))}
      </SimpleGrid>

      {spentGoals.length > 0 && (
        <Card>
          <Stack gap="xs">
            <CardLabel>Потраченные цели · {spentGoals.length}</CardLabel>
            {spentGoals.map((g) => (
              <Group key={g.id} justify="space-between">
                <Text fz="sm" c="dimmed">
                  {g.name}
                </Text>
                <Text fz="sm" c="dimmed" className="money">
                  {fmtMoney(g.target)} · {ymTitle(ymOf(g.spentAt ?? today))}
                </Text>
              </Group>
            ))}
          </Stack>
        </Card>
      )}
    </Stack>
  );
}
