'use client';

import { useState } from 'react';
import { Alert, Card, Group, SegmentedControl, Stack, Text } from '@mantine/core';
import type { MonthSheet } from '@/queries/month';
import type { TxRow } from '@/queries/core';
import { TxList } from '@/components/TxList';
import { SheetTable, type SheetColumn } from '@/components/sheet/SheetTable';
import { fmtMoney } from '@/lib/money';

export function MonthView({
  ym,
  sheet,
  txs,
  today,
}: {
  ym: string;
  sheet: MonthSheet;
  txs: TxRow[];
  today: string;
}) {
  const [mode, setMode] = useState<'matrix' | 'list'>('matrix');
  const filled = new Set(sheet.filledDays);

  const columns: SheetColumn[] = Array.from({ length: sheet.daysCount }, (_, i) => {
    const d = i + 1;
    const iso = `${ym}-${String(d).padStart(2, '0')}`;
    // подсветка — только у дней, отмеченных заполненными (снятие галочки гасит колонку)
    return { key: d, label: String(d), href: `/day/${iso}`, highlight: filled.has(d) };
  });

  return (
    <Stack gap="md">
      {sheet.pendingWarnings.length > 0 && (
        <Alert color="red" variant="light" radius="lg" title="Категории, помеченные к удалению, ещё содержат данные">
          <Stack gap={4}>
            {sheet.pendingWarnings.map((w) => (
              <Text key={w.name} fz="sm">
                «{w.groupName} → {w.name}»: {fmtMoney(w.total)} в месяцах {w.months.join(', ')}.
                Перенесите записи — удаление станет доступно, когда всё обнулится.
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

      <Group gap="sm">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          data={[
            { value: 'matrix', label: 'Матрица' },
            { value: 'list', label: 'Список' },
          ]}
          size="sm"
        />
      </Group>

      {mode === 'matrix' ? (
        <SheetTable
          columns={columns}
          sections={sheet.sections}
          topRows={[
            {
              label: 'Начисленные',
              total: sheet.accruedTotal,
              values: sheet.accruedTotals,
              totalBg: 'var(--mantine-color-ink-0)',
            },
            { label: 'Фактические', total: sheet.actualTotal, values: sheet.actualTotals, muted: true },
          ]}
        />
      ) : (
        <Card>
          <TxList items={txs} showDate emptyText="За месяц операций нет" />
        </Card>
      )}
    </Stack>
  );
}
