import { Card, Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { CardLabel } from '@/components/CardLabel';
import { ViewNav } from '@/components/ViewNav';
import { FundToolbar } from '@/components/fund/FundActions';
import { FundMovesList } from '@/components/fund/FundMovesList';
import { listFundMovesPage } from '@/actions/fund';
import { getFundOverview } from '@/queries/fund';
import { getReference } from '@/queries/core';
import { todayISO } from '@/lib/dates';

export const metadata = { title: 'КС · движения' };

export const dynamic = 'force-dynamic';

export default async function FundMovesPage() {
  const year = todayISO().slice(0, 4);
  const [{ items, nextCursor }, fund, ref] = await Promise.all([
    listFundMovesPage(null),
    getFundOverview(year),
    getReference(),
  ]);
  const moneyAccounts = ref.accounts
    .filter((a) => ['checking', 'cash'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <Stack gap="md">
      <PageHeader
        title="КС"
        beside={
          <ViewNav
            value="moves"
            options={[
              { value: 'sheet', label: 'Таблица', href: '/fund' },
              { value: 'moves', label: 'Движения', href: '/fund/moves' },
            ]}
          />
        }
        subtitle="все движения фонда, от новых к старым"
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
      <Card>
        <Stack gap="sm">
          <CardLabel>Отложено и израсходовано</CardLabel>
          <FundMovesList initial={items} initialCursor={nextCursor} />
        </Stack>
      </Card>
    </Stack>
  );
}
