'use client';

import { useState } from 'react';
import { ActionIcon, Card, Group, Stack, Table, Text, Tooltip } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { fmtNumber } from '@/lib/money';

export type CapMonthCell = { fact: number; plan: number };
export type CapMonthCol = { ym: string; label: string };

/** Взносы КАП по месяцам и категориям: факт из флажков (с перетоками),
    план — из столбца «КАП/мес». Листается по шесть месяцев. */
export function CapMonthlyTable({
  columns,
  categories,
  cells,
  transfers,
}: {
  columns: CapMonthCol[]; // все месяцы по возрастанию
  categories: string[];
  cells: Record<string, CapMonthCell>; // `${category}:${ym}`
  /** переводы на счёт КАП по месяцам — сверка с таблицей месяца */
  transfers: Record<string, number>;
}) {
  const WINDOW = 6;
  const [end, setEnd] = useState(columns.length); // окно [end-6, end)
  const start = Math.max(0, end - WINDOW);
  const visible = columns.slice(start, end);

  const num = (v: number) => (Math.abs(v) < 0.005 ? '0' : fmtNumber(v, 0));

  return (
    <Card p={0}>
      <Group px="md" h={48} justify="space-between" wrap="nowrap" className="group-head-inner">
        <Text fw={600}>Взносы по месяцам</Text>
        <Group gap={4} wrap="nowrap">
          <Tooltip label="Раньше">
            <ActionIcon
              variant="default"
              size="sm"
              disabled={start === 0}
              onClick={() => setEnd(Math.max(WINDOW, end - WINDOW))}
              aria-label="Предыдущие месяцы"
            >
              <IconChevronLeft size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Позже">
            <ActionIcon
              variant="default"
              size="sm"
              disabled={end >= columns.length}
              onClick={() => setEnd(Math.min(columns.length, end + WINDOW))}
              aria-label="Следующие месяцы"
            >
              <IconChevronRight size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
      <div className="group-scroll">
        <Table miw={760} verticalSpacing={6} horizontalSpacing={12} fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th />
              {visible.map((c) => (
                <Table.Th key={c.ym} ta="center" style={{ whiteSpace: 'nowrap' }}>
                  <Text fz="sm" fw={600} c="ink.6" tt="capitalize">
                    {c.label}
                  </Text>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {categories.map((cat) => (
              <Table.Tr key={cat}>
                <Table.Td>
                  <Text fz="sm" fw={500} truncate maw={200}>
                    {cat}
                  </Text>
                </Table.Td>
                {visible.map((c) => {
                  const cell = cells[`${cat}:${c.ym}`] ?? { fact: 0, plan: 0 };
                  const ok = cell.plan > 0 && cell.fact >= cell.plan - 1;
                  return (
                    <Table.Td key={c.ym} ta="right">
                      <Text
                        fz="sm"
                        className="money"
                        fw={500}
                        c={cell.fact < 0.005 ? 'gray.4' : ok ? 'teal.8' : undefined}
                      >
                        {num(cell.fact)}
                      </Text>
                      <Text fz={10} c="dimmed" className="money" lh={1.2}>
                        план {num(cell.plan)}
                      </Text>
                    </Table.Td>
                  );
                })}
              </Table.Tr>
            ))}
            <Table.Tr>
              <Table.Td>
                <Text fz="sm" fw={700}>
                  Итого
                </Text>
              </Table.Td>
              {visible.map((c) => {
                const fact = categories.reduce((s, cat) => s + (cells[`${cat}:${c.ym}`]?.fact ?? 0), 0);
                const plan = categories.reduce((s, cat) => s + (cells[`${cat}:${c.ym}`]?.plan ?? 0), 0);
                return (
                  <Table.Td key={c.ym} ta="right">
                    <Text fz="sm" fw={700} className="money">
                      {num(fact)}
                    </Text>
                    <Text fz={10} c="dimmed" className="money" lh={1.2}>
                      план {num(plan)}
                    </Text>
                  </Table.Td>
                );
              })}
            </Table.Tr>
            <Table.Tr>
              <Table.Td style={{ borderTop: '2px solid var(--table-border-color, var(--mantine-color-gray-3))' }}>
                <Text fz="sm" c="dimmed">
                  Переводы на КАП
                </Text>
                <Text fz={10} c="dimmed" lh={1.2}>
                  сверка с таблицей месяца
                </Text>
              </Table.Td>
              {visible.map((c) => {
                const fact = categories.reduce((s, cat) => s + (cells[`${cat}:${c.ym}`]?.fact ?? 0), 0);
                const tr = transfers[c.ym] ?? 0;
                const match = Math.abs(tr - fact) <= 1;
                return (
                  <Table.Td
                    key={c.ym}
                    ta="right"
                    style={{ borderTop: '2px solid var(--table-border-color, var(--mantine-color-gray-3))' }}
                  >
                    <Text
                      fz="sm"
                      className="money"
                      c={tr < 0.005 && fact < 0.005 ? 'gray.4' : match ? 'teal.8' : 'red.8'}
                    >
                      {num(tr)}
                    </Text>
                    <Text fz={10} c="dimmed" className="money" lh={1.2}>
                      {match ? 'сходится ✓' : `разница ${num(tr - fact)}`}
                    </Text>
                  </Table.Td>
                );
              })}
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </div>
    </Card>
  );
}
