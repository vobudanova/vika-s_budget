import { Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { getAccountBalances, splitBalances, type AccountBalance } from '@/queries/core';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { AnchorLink } from '@/components/links';
import { fmtMoney } from '@/lib/money';
import { dateTitleFull, todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const GROUPS: { title: string; types: string[] }[] = [
  { title: 'Карты', types: ['checking', 'credit_card'] },
  { title: 'Накопительные счета', types: ['savings_cap', 'savings_ks'] },
  { title: 'Наличные', types: ['cash'] },
  { title: 'Сбережения и активы', types: ['metals', 'brokerage', 'deposit', 'receivable'] },
];

export default async function BalancePage() {
  const balances = await getAccountBalances();
  const { totalRub, totalUsd } = splitBalances(balances);

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

      <Group justify="center">
        <AnchorLink href="/accounts" fz="sm">
          Сверка, вклады и долги →
        </AnchorLink>
      </Group>
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
