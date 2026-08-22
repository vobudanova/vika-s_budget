import { Card, Stack } from '@mantine/core';
import { sql } from 'drizzle-orm';
import { PageHeader } from '@/components/PageHeader';
import { CardLabel } from '@/components/CardLabel';
import { ViewNav } from '@/components/ViewNav';
import { IncomeToolbar } from '@/components/income/IncomeToolbar';
import { IncomeList } from '@/components/income/IncomeList';
import { getReference, getTransactions } from '@/queries/core';
import { categorySelectData } from '@/components/tx-helpers';
import { todayISO } from '@/lib/dates';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'Доходы · список' };

export const dynamic = 'force-dynamic';

const PAGE = 50;

export default async function IncomeListPage() {
  const ref = await getReference(todayISO());
  const firstPage = await getTransactions(sql`t.kind IN ('income', 'coverage_in')`, PAGE + 1);
  const initial = firstPage.slice(0, PAGE);
  const last = initial[initial.length - 1];
  const cursor = firstPage.length > PAGE && last ? { date: last.date, id: last.id } : null;

  const checkingId = ref.accounts.find((a) => a.type === 'checking')?.id ?? null;
  const compensationSource = ref.incomeSources.find((s) => s.type === 'compensation') ?? null;

  return (
    <Stack gap="md">
      <PageHeader
        title="Доходы"
        beside={
          <ViewNav
            value="list"
            options={[
              { value: 'sheet', label: 'Таблица', href: '/income' },
              { value: 'list', label: 'Список', href: '/income/list' },
            ]}
          />
        }
        subtitle="все операции, от новых к старым"
        right={
          <IncomeToolbar
            sources={ref.incomeSources.map((s) => ({ id: s.id, name: s.name }))}
            accounts={ref.accounts
              .filter((a) => ['checking', 'cash'].includes(a.type))
              .map((a) => ({ id: a.id, name: a.name }))}
            defaultAccountId={checkingId}
            categories={categorySelectData(ref.groups, ref.categories)}
            compensationSourceId={compensationSource?.id ?? null}
          />
        }
      />
      <Card>
        <Stack gap="sm">
          <CardLabel>Все поступления</CardLabel>
          <IncomeList initial={initial} initialCursor={cursor} />
        </Stack>
      </Card>
      <WipeButton scope={{ scope: 'income' }} label="все записи доходов" />
    </Stack>
  );
}
