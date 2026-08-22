import {
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
import { CapGoalRow } from '@/components/cap/CapGoalRow';
import { CapPaymentButton } from '@/components/cap/CapPaymentButton';
import { getCapOverview, type CapGoalOverview } from '@/queries/cap';
import { getReference } from '@/queries/core';
import { todayISO, ymOf, ymTitle } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
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

  // цели по категориям активов, внутри — по дате начала амортизации
  const byCategory = new Map<string, CapGoalOverview[]>();
  for (const g of activeGoals) {
    const key = g.assetCategoryName ?? 'Без категории';
    byCategory.set(key, [...(byCategory.get(key) ?? []), g]);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  }

  return (
    <Stack gap="md">
      <PageHeader
        title="КАП"
        subtitle={fmtMoney(cap.ledgerTotal)}
        right={
          <CapPaymentButton
            ym={currentYm}
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
          </Stack>
        </Card>
      </SimpleGrid>

      {activeGoals.length === 0 && (
        <Card>
          <Text c="dimmed">Целей пока нет.</Text>
        </Card>
      )}

      {[...byCategory.entries()].map(([cat, goals]) => (
        <Card key={cat} p={0}>
          <Group px="md" py="sm" justify="space-between">
            <Text fw={600}>{cat}</Text>
            <Text fz="sm" c="dimmed" className="money">
              {fmtMoney(goals.reduce((s, g) => s + g.contributed, 0))}
            </Text>
          </Group>
          <ScrollArea type="auto" offsetScrollbars>
            <Table miw={1080} verticalSpacing={6} horizontalSpacing={12} fz="sm">
              <TableThead>
                <TableTr>
                  <TableTh ta="center">Цель</TableTh>
                  <TableTh ta="center">Начало</TableTh>
                  <TableTh ta="center">КАП/мес</TableTh>
                  <TableTh ta="center">Отложено</TableTh>
                  <TableTh ta="center">Остаток</TableTh>
                  <TableTh ta="center">Цель, ₽</TableTh>
                  <TableTh ta="center">Статус</TableTh>
                  <TableTh ta="center">Флажки</TableTh>
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
          </ScrollArea>
        </Card>
      ))}

      {spentGoals.length > 0 && (
        <Card>
          <Stack gap="xs">
            <CardLabel>Завершено</CardLabel>
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
      <WipeButton scope={{ scope: 'cap' }} label="все цели КАП и их движения" />
    </Stack>
  );
}
