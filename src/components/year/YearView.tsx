'use client';

import { useState } from 'react';
import {
  Card,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import type { YearData, YearRow } from '@/queries/year';
import { RU_MONTHS } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
import { Money } from '@/components/Money';

export function YearView({ data }: { data: YearData }) {
  const [method, setMethod] = useState<'actual' | 'accrued'>('actual');
  const rows = method === 'actual' ? data.actual : data.accrued;
  const totals = method === 'actual' ? data.actualTotals : data.accruedTotals;
  const yearTotal = method === 'actual' ? data.actualYear : data.accruedYear;

  return (
    <Stack gap="md">
      <Group gap="sm">
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
          расходы за год: <Money value={yearTotal} fw={600} c="dark.8" />
        </Text>
      </Group>

      <Card p={0}>
        <ScrollArea type="auto" offsetScrollbars>
          <Table miw={900} fz="xs" verticalSpacing={4}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 150 }}>Группа</Table.Th>
                <Table.Th ta="right">Σ год</Table.Th>
                {RU_MONTHS.map((m) => (
                  <Table.Th key={m} ta="right">
                    {m.slice(0, 3)}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <YearTr key={r.name} r={r} />
              ))}
              <TotalTr label="Расходы" totals={totals} total={yearTotal} strong />
              <TotalTr label="Доходы" totals={data.incomeTotals} total={data.incomeYear} accent />
              <TotalTr label="Сбережения" totals={data.savingsTotals} total={data.savingsYear} />
              <BalanceTr data={data} totals={totals} />
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      <Text fz="xs" c="dimmed">
        Компенсировано из КС за год: {fmtMoney(data.ksReimbursedYear)} · теневые расходы:{' '}
        {fmtMoney(data.coveredYear)} — в итоги расходов не входят.
      </Text>
    </Stack>
  );
}

function YearTr({ r }: { r: YearRow }) {
  return (
    <Table.Tr>
      <Table.Td>{r.name}</Table.Td>
      <Table.Td ta="right" className="money" fw={600}>
        {r.total ? fmtMoney(r.total) : ''}
      </Table.Td>
      {r.months.slice(1).map((v, i) => (
        <Table.Td key={i} ta="right" className="money">
          {v ? fmtMoney(v) : ''}
        </Table.Td>
      ))}
    </Table.Tr>
  );
}

function TotalTr({
  label,
  totals,
  total,
  strong,
  accent,
}: {
  label: string;
  totals: number[];
  total: number;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <Table.Tr style={strong ? { borderTop: '2px solid var(--ink-line)' } : undefined}>
      <Table.Td>
        <Text fz="xs" fw={700} c={accent ? 'ink.7' : undefined}>
          {label}
        </Text>
      </Table.Td>
      <Table.Td ta="right" className="money" fw={700} c={accent ? 'var(--mantine-color-ink-7)' : undefined}>
        {fmtMoney(total)}
      </Table.Td>
      {totals.slice(1).map((v, i) => (
        <Table.Td key={i} ta="right" className="money" c={accent ? 'var(--mantine-color-ink-7)' : undefined}>
          {v ? fmtMoney(v) : ''}
        </Table.Td>
      ))}
    </Table.Tr>
  );
}

function BalanceTr({ data, totals }: { data: YearData; totals: number[] }) {
  const diff = Array(13).fill(0);
  for (let m = 1; m <= 12; m++) diff[m] = data.incomeTotals[m] - totals[m];
  const total = data.incomeYear - totals.reduce((s, v) => s + v, 0);
  return (
    <Table.Tr style={{ borderTop: '2px solid var(--ink-line)' }}>
      <Table.Td>
        <Text fz="xs" fw={700}>
          Доходы − расходы
        </Text>
      </Table.Td>
      <Table.Td ta="right" className="money" fw={700}>
        <Text span c={total >= 0 ? 'ink.7' : 'red.8'} inherit>
          {fmtMoney(total)}
        </Text>
      </Table.Td>
      {diff.slice(1).map((v, i) => (
        <Table.Td key={i} ta="right" className="money">
          {v ? (
            <Text span c={v >= 0 ? 'ink.7' : 'red.8'} inherit>
              {fmtMoney(v)}
            </Text>
          ) : (
            ''
          )}
        </Table.Td>
      ))}
    </Table.Tr>
  );
}
