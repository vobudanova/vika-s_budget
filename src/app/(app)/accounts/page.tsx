import { Stack } from '@mantine/core';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { PageHeader } from '@/components/PageHeader';
import { AccountMovesView, type AccountChip } from '@/components/accounts/AccountMovesView';
import { listAccountMovesPage } from '@/actions/transactions';
import { toNum } from '@/lib/money';

export const metadata = { title: 'Движение по счетам' };

export const dynamic = 'force-dynamic';

/** Все счета и полная лента операций по каждому — включая скрытые из таблиц;
    здесь же видны все компенсации из КС. */
export default async function AccountsPage() {
  const res = await db.execute(sql`
    SELECT account_id, name, balance FROM v_account_balances ORDER BY sort_order, name
  `);
  const accounts: AccountChip[] = (res.rows as any[]).map((r) => ({
    id: Number(r.account_id),
    name: r.name as string,
    balance: toNum(r.balance),
  }));

  const first = accounts[0];
  const firstPage = first
    ? await listAccountMovesPage(first.id, 'all', null)
    : { items: [], nextCursor: null };

  return (
    <Stack gap="md">
      <PageHeader
        title="Движение по счетам"
        subtitle="Все операции счёта, включая скрытые из таблиц"
      />
      <AccountMovesView
        accounts={accounts}
        initial={firstPage.items}
        initialCursor={firstPage.nextCursor}
      />
    </Stack>
  );
}
