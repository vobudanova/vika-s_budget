import { Card, Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { CardLabel } from '@/components/CardLabel';
import { ViewNav } from '@/components/ViewNav';
import { FundMovesList } from '@/components/fund/FundMovesList';
import { listFundMovesPage } from '@/actions/fund';

export const metadata = { title: 'КС · движения' };

export const dynamic = 'force-dynamic';

export default async function FundMovesPage() {
  const { items, nextCursor } = await listFundMovesPage(null);

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
