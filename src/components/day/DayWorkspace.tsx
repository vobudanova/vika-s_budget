'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Card,
  Divider,
  Group,
  NavLink,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import type { TxRow } from '@/queries/core';
import type { SelectGroup } from '@/components/tx-helpers';
import { QuickExpense } from '@/components/QuickExpense';
import { TxList } from '@/components/TxList';
import { Money } from '@/components/Money';
import { PurchaseForm } from './PurchaseForm';
import { TransferForm } from './TransferForm';
import { ReimburseForm } from './ReimburseForm';
import { SavingForm } from './SavingForm';

type Account = { id: number; name: string; type: string };

const BLOCKS = [
  { key: 'spend', label: 'Траты' },
  { key: 'purchase', label: 'Покупка' },
  { key: 'transfer', label: 'Переводы' },
  { key: 'cash', label: 'Наличные' },
  { key: 'ks', label: 'Комп. из КС' },
  { key: 'saving', label: 'Сбережения' },
] as const;

type BlockKey = (typeof BLOCKS)[number]['key'];

export function DayWorkspace({
  date,
  txs,
  categories,
  accounts,
  fundCategories,
  assetCategories,
  inflationRate,
}: {
  date: string;
  txs: TxRow[];
  categories: SelectGroup[];
  accounts: Account[];
  fundCategories: { id: number; name: string; groupName: string }[];
  assetCategories: { id: number; name: string }[];
  inflationRate: number;
}) {
  const [block, setBlock] = useState<BlockKey>('spend');

  const checking = accounts.find((a) => a.type === 'checking') ?? null;
  const cash = accounts.find((a) => a.type === 'cash' && a.name.includes('₽')) ?? null;

  const counts = useMemo(() => {
    const c: Record<BlockKey, number> = { spend: 0, purchase: 0, transfer: 0, cash: 0, ks: 0, saving: 0 };
    for (const t of txs) {
      if (t.kind === 'expense' && t.accountId === cash?.id) c.cash++;
      else if (t.kind === 'expense') c.spend++;
      else if (t.kind === 'purchase') c.purchase++;
      else if (t.kind === 'transfer' || t.kind === 'asset_resale' || t.kind === 'coverage_in') c.transfer++;
      else if (t.kind === 'reimbursement') c.ks++;
      else if (t.kind === 'saving') c.saving++;
    }
    return c;
  }, [txs, cash?.id]);

  const [cashMode, setCashMode] = useState<'expense' | 'purchase'>('expense');

  const expenseTxs = txs.filter((t) => t.kind === 'expense' && t.accountId !== cash?.id);
  const cashTxs = txs.filter((t) => t.kind === 'expense' && t.accountId === cash?.id);
  const purchaseTxs = txs.filter((t) => t.kind === 'purchase');
  const transferTxs = txs.filter((t) => ['transfer', 'asset_resale', 'coverage_in'].includes(t.kind));
  const ksTxs = txs.filter((t) => t.kind === 'reimbursement');
  const savingTxs = txs.filter((t) => t.kind === 'saving');

  const content = (
    <Stack gap="md">
      {block === 'spend' && (
        <>
          <QuickExpense date={date} categories={categories} defaultAccountId={checking?.id ?? null} />
          <Divider />
          <GroupedList txs={expenseTxs} />
        </>
      )}
      {block === 'purchase' && (
        <>
          <PurchaseForm
            date={date}
            assetCategories={assetCategories}
            accounts={accounts.filter((a) => ['checking', 'credit_card', 'cash'].includes(a.type))}
            defaultAccountId={checking?.id ?? null}
            inflationRate={inflationRate}
          />
          {purchaseTxs.length > 0 && (
            <>
              <Divider label="Покупки дня" labelPosition="left" />
              <TxList items={purchaseTxs} />
            </>
          )}
        </>
      )}
      {block === 'transfer' && (
        <>
          <TransferForm date={date} accounts={accounts} defaultAccountId={checking?.id ?? null} />
          {transferTxs.length > 0 && (
            <>
              <Divider label="Переводы дня" labelPosition="left" />
              <TxList items={transferTxs} />
            </>
          )}
        </>
      )}
      {block === 'cash' && (
        <>
          <SegmentedControl
            value={cashMode}
            onChange={(v) => setCashMode(v as typeof cashMode)}
            data={[
              { value: 'expense', label: 'Трата' },
              { value: 'purchase', label: 'Покупка' },
            ]}
            size="xs"
            w="fit-content"
          />
          {cashMode === 'expense' ? (
            <QuickExpense date={date} categories={categories} defaultAccountId={cash?.id ?? null} />
          ) : (
            <PurchaseForm
              date={date}
              assetCategories={assetCategories}
              accounts={accounts.filter((a) => a.type === 'cash')}
              defaultAccountId={cash?.id ?? null}
              inflationRate={inflationRate}
            />
          )}
          {cashTxs.length > 0 && (
            <>
              <Divider label="Наличные за день" labelPosition="left" />
              <TxList items={cashTxs} />
            </>
          )}
        </>
      )}
      {block === 'ks' && (
        <>
          <ReimburseForm date={date} fundCategories={fundCategories} />
          {ksTxs.length > 0 && (
            <>
              <Divider label="Компенсации дня" labelPosition="left" />
              <TxList items={ksTxs} />
            </>
          )}
        </>
      )}
      {block === 'saving' && (
        <>
          <SavingForm date={date} accounts={accounts} defaultAccountId={checking?.id ?? null} />
          {savingTxs.length > 0 && (
            <>
              <Divider label="Сбережения дня" labelPosition="left" />
              <TxList items={savingTxs} />
            </>
          )}
        </>
      )}
    </Stack>
  );

  return (
    <>
      {/* мобильный переключатель */}
      <ScrollArea type="never" hiddenFrom="sm" mb="sm">
        <SegmentedControl
          value={block}
          onChange={(v) => setBlock(v as BlockKey)}
          data={BLOCKS.map((b) => ({
            value: b.key,
            label: counts[b.key] > 0 ? `${b.label} · ${counts[b.key]}` : b.label,
          }))}
          size="xs"
        />
      </ScrollArea>

      <Group align="flex-start" gap="md" wrap="nowrap">
        {/* левый рейл на десктопе */}
        <Card visibleFrom="sm" w={196} p="xs" style={{ flexShrink: 0 }}>
          <Stack gap={2}>
            {BLOCKS.map((b) => (
              <NavLink
                key={b.key}
                label={b.label}
                active={block === b.key}
                onClick={() => setBlock(b.key)}
                rightSection={
                  counts[b.key] > 0 ? (
                    <Badge size="xs" variant="light" circle>
                      {counts[b.key]}
                    </Badge>
                  ) : undefined
                }
                fw={500}
                style={{ borderRadius: 'var(--mantine-radius-md)' }}
              />
            ))}
          </Stack>
        </Card>
        <Card style={{ flex: 1, minWidth: 0 }}>{content}</Card>
      </Group>
    </>
  );
}

function GroupedList({ txs }: { txs: TxRow[] }) {
  if (txs.length === 0) {
    return (
      <Text c="dimmed" fz="sm">
        Трат за этот день пока нет
      </Text>
    );
  }
  const groups = [...new Set(txs.map((t) => t.groupName ?? 'Прочее'))];
  return (
    <Stack gap="sm">
      {groups.map((g) => {
        const items = txs.filter((t) => (t.groupName ?? 'Прочее') === g);
        const sum = items.reduce((s, t) => s + t.amount, 0);
        return (
          <Stack key={g} gap={2}>
            <Group justify="space-between">
              <Text fw={600} fz="sm">
                {g}
              </Text>
              <Money value={sum} fz="sm" fw={600} />
            </Group>
            <TxList items={items} />
          </Stack>
        );
      })}
    </Stack>
  );
}
