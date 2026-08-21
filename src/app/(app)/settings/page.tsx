import { Stack } from '@mantine/core';
import { asc } from 'drizzle-orm';
import { db, schema } from '@/db';
import { PageHeader } from '@/components/PageHeader';
import { SettingsPanels } from '@/components/settings/SettingsPanels';
import { getSetting } from '@/queries/core';
import { toNum } from '@/lib/money';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const [groups, categories, fundCategories, sources, accounts, inflationRate] = await Promise.all([
    db.select().from(schema.categoryGroups).orderBy(asc(schema.categoryGroups.sortOrder)),
    db.select().from(schema.categories).orderBy(asc(schema.categories.sortOrder)),
    db.select().from(schema.fundCategories).orderBy(asc(schema.fundCategories.sortOrder)),
    db.select().from(schema.incomeSources).orderBy(asc(schema.incomeSources.sortOrder)),
    db.select().from(schema.accounts).orderBy(asc(schema.accounts.sortOrder)),
    getSetting<number>('cap_inflation_rate', 1.1),
  ]);

  return (
    <Stack gap="md">
      <PageHeader title="Настройки" subtitle="Справочники и параметры" />
      <SettingsPanels
        inflationRate={inflationRate}
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        categories={categories.map((c) => ({
          id: c.id,
          groupId: c.groupId,
          name: c.name,
          activeTo: c.activeTo,
          pendingDelete: c.pendingDelete,
        }))}
        fundCategories={fundCategories.map((f) => ({
          id: f.id,
          name: f.name,
          groupName: f.groupName,
          monthlyPlan: toNum(f.monthlyPlan),
        }))}
        sources={sources.map((s) => ({
          id: s.id,
          name: s.name,
          type: s.type,
          expectedMonthly: s.expectedMonthly ? toNum(s.expectedMonthly) : null,
        }))}
        accounts={accounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          isActive: a.isActive,
        }))}
      />
    </Stack>
  );
}
