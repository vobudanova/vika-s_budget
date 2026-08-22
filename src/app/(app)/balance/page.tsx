import { Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getAccountBalances, splitBalances, type AccountBalance } from '@/queries/core';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { AccountsBoard } from '@/components/accounts/AccountsBoard';
import { InterestDeposits, Obligations } from '@/components/accounts/DepositsAndDebts';
import { fmtMoney, toNum } from '@/lib/money';
import { dateTitleFull, todayISO } from '@/lib/dates';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'Баланс' };

export const dynamic = 'force-dynamic';

const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Карты', types: ['checking', 'credit_card'] },
  { title: 'Накопительные счета', types: ['savings_cap', 'savings_ks'] },
  { title: 'Наличные', types: ['cash'] },
  { title: 'Сбережения и активы', types: ['metals', 'brokerage', 'deposit', 'receivable'] },
];

export default async function BalancePage() {
  const [balances, obligations, accountRows] = await Promise.all([
    getAccountBalances(),
    db.select().from(schema.obligations).orderBy(desc(schema.obligations.openedAt)),
    db.select().from(schema.accounts),
  ]);
  const { totalRub, totalUsd } = splitBalances(balances);

  const interestIds = new Set(
    accountRows.filter((a) => a.depositKind === 'interest' && a.isActive).map((a) => a.id),
  );
  const deposits = balances
    .filter((b) => b.type === 'deposit' && interestIds.has(b.accountId))
    .map((b) => ({ id: b.accountId, name: b.name, balance: b.balance }));
  const checking = accountRows.find((a) => a.type === 'checking' && a.isActive) ?? null;

  return (
    <Stack gap="xl">
      <Stack gap={6} align="center" ta="center" pt="md">
        <CardLabel>Баланс · все счета</CardLabel>
        <Money value={totalRub} fz={{ base: 40, xs: 56 }} fw={600} lts="-0.02em" />
        {totalUsd > 0 && (
          <Text c="dimmed" fz="lg" className="money">
            + {fmtMoney(totalUsd, 'USD')} по цене покупки
          </Text>
        )}
        <Text c="dimmed" fz="sm">
          {dateTitleFull(todayISO())}
        </Text>
      </Stack>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {GROUPS.map((g) => (
          <BalanceGroup key={g.title} title={g.title} accounts={balances.filter((b) => g.types.includes(b.type))} />
        ))}
      </SimpleGrid>

      <Card>
        <AccountsBoard balances={balances} />
      </Card>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>Процентные вклады</CardLabel>
            <InterestDeposits
              deposits={deposits}
              accounts={accountRows
                .filter((a) => a.type === 'checking' && a.isActive)
                .map((a) => ({ id: a.id, name: a.name }))}
              defaultAccountId={checking?.id ?? null}
            />
          </Stack>
        </Card>
        <Card>
          <Stack gap="sm">
            <CardLabel>Долги и обязательства</CardLabel>
            <Obligations
              items={obligations.map((o) => ({
                id: o.id,
                title: o.title,
                amount: toNum(o.amount),
                status: o.status,
                openedAt: o.openedAt,
                note: o.note,
              }))}
            />
          </Stack>
        </Card>
      </SimpleGrid>
      <WipeButton scope={{ scope: 'balance' }} label="все снапшоты сверки и обязательства" />
    </Stack>
  );
}

function BalanceGroup({ title, accounts }: { title: string; accounts: AccountBalance[] }) {
  if (accounts.length === 0) return null;
  const totalRub = accounts.filter((a) => a.currency === 'RUB').reduce((s, a) => s + a.balance, 0);

  return (
    <Card>
      <Stack gap="sm">
        <Group justify="space-between" align="baseline">
          <CardLabel>{title}</CardLabel>
          <Money value={totalRub} fw={600} fz="md" />
        </Group>
        <Stack gap={6}>
          {accounts.map((a) => (
            <Group key={a.accountId} justify="space-between" wrap="nowrap">
              <Text fz="sm" c={a.balance === 0 ? 'dimmed' : undefined} truncate>
                {a.name}
              </Text>
              <Money
                value={a.balance}
                currency={a.currency}
                fz="sm"
                c={a.balance === 0 ? 'dimmed' : a.balance < 0 ? 'red.8' : undefined}
              />
            </Group>
          ))}
        </Stack>
      </Stack>
    </Card>
  );
}
