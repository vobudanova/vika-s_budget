'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import type { MonthMatrix } from '@/queries/month';
import type { TxRow } from '@/queries/core';
import { TxList } from '@/components/TxList';
import { Money } from '@/components/Money';
import { fmtNumber } from '@/lib/money';

export function MonthView({
  ym,
  actual,
  accrued,
  txs,
  today,
}: {
  ym: string;
  actual: MonthMatrix;
  accrued: MonthMatrix;
  txs: TxRow[];
  today: string;
}) {
  const [mode, setMode] = useState<'matrix' | 'list'>('matrix');
  const [method, setMethod] = useState<'actual' | 'accrued'>('actual');
  const matrix = method === 'actual' ? actual : accrued;

  return (
    <Stack gap="md">
      <Group gap="sm" wrap="wrap">
        <SegmentedControl
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          data={[
            { value: 'matrix', label: 'Матрица' },
            { value: 'list', label: 'Список' },
          ]}
          size="xs"
        />
        <SegmentedControl
          value={method}
          onChange={(v) => setMethod(v as typeof method)}
          data={[
            { value: 'actual', label: 'Фактические' },
            { value: 'accrued', label: 'Начисленные' },
          ]}
          size="xs"
        />
        <Text fz="sm" c="dimmed">
          итог месяца: <Money value={matrix.total} fw={600} c="dark.8" />
        </Text>
      </Group>

      {mode === 'matrix' ? (
        <Card p={0}>
          <ScrollArea type="auto" offsetScrollbars>
            <Table
              fz="xs"
              verticalSpacing={3}
              horizontalSpacing={6}
              withColumnBorders={false}
              miw={720}
              stickyHeader
            >
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={firstCol}>Категория</Table.Th>
                  <Table.Th ta="right" style={{ minWidth: 76 }}>
                    Σ мес
                  </Table.Th>
                  {range(matrix.daysCount).map((d) => {
                    const iso = `${ym}-${String(d).padStart(2, '0')}`;
                    const isToday = iso === today;
                    return (
                      <Table.Th key={d} ta="right" p={2}>
                        <Text
                          component={Link}
                          href={`/day/${iso}`}
                          fz="xs"
                          fw={isToday ? 700 : 500}
                          c={isToday ? 'ink.7' : 'dimmed'}
                          td="none"
                          style={
                            isToday
                              ? {
                                  background: 'var(--mantine-color-ink-0)',
                                  borderRadius: 4,
                                  padding: '1px 4px',
                                }
                              : undefined
                          }
                        >
                          {d}
                        </Text>
                      </Table.Th>
                    );
                  })}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {matrix.groups.map((g) => (
                  <GroupRows key={g.name} g={g} ym={ym} daysCount={matrix.daysCount} />
                ))}
                <Table.Tr style={{ borderTop: '2px solid var(--ink-line)' }}>
                  <Table.Td style={firstCol}>
                    <Text fz="xs" fw={700}>
                      Итого
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right" className="money" fw={700}>
                    {fmtNumber(matrix.total, 0)}
                  </Table.Td>
                  {range(matrix.daysCount).map((d) => (
                    <Table.Td key={d} ta="right" className="money" c="dimmed">
                      {matrix.dayTotals[d] ? fmtNumber(matrix.dayTotals[d], 0) : ''}
                    </Table.Td>
                  ))}
                </Table.Tr>
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Card>
      ) : (
        <Card>
          <TxList items={txs} showDate emptyText="За месяц операций нет" />
        </Card>
      )}
      {mode === 'matrix' && (
        <Text fz="xs" c="dimmed">
          Числа в шапке — ссылки на страницу дня. Начисленный метод показывает амортизацию вместо
          покупок; компенсации из КС и теневые расходы не входят ни в один метод.
        </Text>
      )}
    </Stack>
  );
}

const firstCol: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--mantine-color-white)',
  minWidth: 168,
  zIndex: 1,
};

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

function GroupRows({
  g,
  ym,
  daysCount,
}: {
  g: { name: string; rows: { categoryId: number; name: string; days: number[]; total: number }[]; dayTotals: number[]; total: number };
  ym: string;
  daysCount: number;
}) {
  void ym;
  return (
    <>
      <Table.Tr style={{ background: 'var(--mantine-color-gray-0)' }}>
        <Table.Td style={{ ...firstCol, background: 'var(--mantine-color-gray-0)' }}>
          <Text fz="xs" fw={700}>
            {g.name}
          </Text>
        </Table.Td>
        <Table.Td ta="right" className="money" fw={600}>
          {g.total ? fmtNumber(g.total, 0) : ''}
        </Table.Td>
        {range(daysCount).map((d) => (
          <Table.Td key={d} ta="right" className="money" c="dimmed">
            {g.dayTotals[d] ? fmtNumber(g.dayTotals[d], 0) : ''}
          </Table.Td>
        ))}
      </Table.Tr>
      {g.rows.map((r) => (
        <Table.Tr key={r.categoryId}>
          <Table.Td style={firstCol}>
            <Text fz="xs" pl={12} c="dark.4" truncate>
              {r.name}
            </Text>
          </Table.Td>
          <Table.Td ta="right" className="money">
            {r.total ? fmtNumber(r.total, 0) : ''}
          </Table.Td>
          {range(daysCount).map((d) => (
            <Table.Td key={d} ta="right" className="money">
              {r.days[d] ? fmtNumber(r.days[d], 0) : ''}
            </Table.Td>
          ))}
        </Table.Tr>
      ))}
    </>
  );
}

