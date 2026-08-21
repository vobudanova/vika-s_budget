import { Card, SimpleGrid, Stack, Text } from '@mantine/core';
import { desc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { PageHeader } from '@/components/PageHeader';
import { CardLabel } from '@/components/CardLabel';
import { AccountsBoard } from '@/components/accounts/AccountsBoard';
import { InterestDeposits, Obligations } from '@/components/accounts/DepositsAndDebts';
import { getAccountBalances, splitBalances } from '@/queries/core';
import { fmtMoney, toNum } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function AccountsPage() {
  const [balances, obligations] = await Promise.all([
    getAccountBalances(),
    db.select().from(schema.obligations).orderBy(desc(schema.obligations.openedAt)),
  ]);
  const { totalRub, totalUsd } = splitBalances(balances);
  // процентные вклады: нужен deposit_kind — дотягиваем из справочника
  const accountRows = await db.select().from(schema.accounts);
  const interestDeposits = balances.filter((b) => b.type === 'deposit');
  const interestIds = new Set(
    accountRows.filter((a) => a.depositKind === 'interest' && a.isActive).map((a) => a.id),
  );
  const deposits = interestDeposits
    .filter((b) => interestIds.has(b.accountId))
    .map((b) => ({ id: b.accountId, name: b.name, balance: b.balance }));

  const checking = accountRows.find((a) => a.type === 'checking' && a.isActive) ?? null;

  return (
    <Stack gap="md">
      <PageHeader
        title="Счета и сверка"
        subtitle={
          <>
            Всего {fmtMoney(totalRub)}
            {totalUsd > 0 ? ` + ${fmtMoney(totalUsd, 'USD')}` : ''} · баланс = последний снапшот +
            операции после него
          </>
        }
      />
      <Card>
        <AccountsBoard balances={balances} />
      </Card>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>Процентные вклады</CardLabel>
            <Text fz="xs" c="dimmed">
              Временное размещение: тело возвращается на исходный счёт, проценты — отдельный доход.
            </Text>
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
    </Stack>
  );
}
