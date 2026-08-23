'use client';

import { useState } from 'react';
import { Card, ScrollArea, Table, Text } from '@mantine/core';
import { CellBreakdownDrawer, type CellQuery } from '@/components/sheet/CellBreakdown';
import { RU_MONTHS } from '@/lib/dates';
import { fmtNumber } from '@/lib/money';

const FS = 15;
const ROW_PY = 3;
const HEAD_FZ = 22;
const BORDER = 'var(--table-border-color, var(--mantine-color-gray-3))';
const bottomLineBg = (px: number) =>
  `linear-gradient(to top, ${BORDER} ${px}px, var(--mantine-color-white) ${px}px)`;

export type IncomeSheetGroup = {
  type: string;
  label: string;
  sources: { id: number; name: string; total: number; months: number[] }[];
};

/** Доходы по источникам в формате листов: группы, лососёвые месяцы, клики-раскладки. */
export function IncomeSheet({
  groups,
  monthTotals,
  yearTotal,
  year,
}: {
  groups: IncomeSheetGroup[];
  monthTotals: number[]; // индексы 0..11
  yearTotal: number;
  year: string;
}) {
  const [cell, setCell] = useState<{ q: CellQuery; title: string } | null>(null);

  const openCell = (row: string | null, title: string, m: number | 'total') => {
    const from = m === 'total' ? `${year}-01-01` : `${year}-${String(m).padStart(2, '0')}-01`;
    const to =
      m === 'total'
        ? `${year}-12-31`
        : `${year}-${String(m).padStart(2, '0')}-${new Date(Number(year), m, 0).getDate()}`;
    setCell({
      q: { from, to, section: 'income', row },
      title: `${title} · ${m === 'total' ? year : RU_MONTHS[m - 1].toLowerCase()}`,
    });
  };

  const num = (
    v: number,
    opts: { strong?: boolean; ta?: 'right' | 'center'; onClick?: () => void; key?: React.Key; pt?: number },
  ) => {
    const isZero = Math.abs(v) < 0.005;
    return (
      <Table.Td
        key={opts.key}
        ta={opts.ta ?? 'right'}
        className="money"
        fw={opts.strong ? 700 : undefined}
        c={isZero ? 'gray.4' : undefined}
        onClick={opts.onClick}
        style={{
          paddingTop: opts.pt ?? ROW_PY,
          paddingBottom: ROW_PY,
          ...(opts.onClick ? { cursor: 'pointer' } : null),
        }}
      >
        {isZero ? '0' : fmtNumber(v, 0)}
      </Table.Td>
    );
  };

  const groupMonth = (g: IncomeSheetGroup, m: number) =>
    g.sources.reduce((s, src) => s + (src.months[m] ?? 0), 0);
  const groupYear = (g: IncomeSheetGroup) => g.sources.reduce((s, src) => s + src.total, 0);

  return (
    <>
      <Card p={0}>
        <ScrollArea type="never">
          <Table
            className="sheet"
            fz={FS}
            verticalSpacing={ROW_PY}
            horizontalSpacing={12}
            miw={1100}
            withColumnBorders
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ minWidth: 190, border: 'none', background: bottomLineBg(1) }} />
                <Table.Th
                  style={{
                    minWidth: 96,
                    border: 'none',
                    background: bottomLineBg(1),
                    boxShadow: `inset -1px 0 0 0 ${BORDER}`,
                  }}
                />
                {RU_MONTHS.map((m) => (
                  <Table.Th
                    key={m}
                    ta="center"
                    py={5}
                    style={{
                      minWidth: 78,
                      border: 'none',
                      background: bottomLineBg(1),
                      boxShadow: `inset -1px 0 0 0 ${BORDER}`,
                    }}
                  >
                    <Text fz={HEAD_FZ} fw={600} c="ink.6">
                      {m.slice(0, 3)}
                    </Text>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td style={{ paddingTop: ROW_PY, paddingBottom: ROW_PY }}>
                  <Text fz={FS} fw={700}>
                    Итого
                  </Text>
                </Table.Td>
                {num(yearTotal, { strong: true, ta: 'center', onClick: () => openCell(null, 'Итого', 'total') })}
                {monthTotals.map((t, i) =>
                  num(t, { strong: true, key: i, onClick: () => openCell(null, 'Итого', i + 1) }),
                )}
              </Table.Tr>
              {groups.map((g) => [
                <Table.Tr key={`g-${g.type}`}>
                  {/* группы разделены воздухом перед заголовком */}
                  <Table.Td style={{ paddingTop: ROW_PY + 10, paddingBottom: ROW_PY }}>
                    <Text fz={FS} fw={700}>
                      {g.label}
                    </Text>
                  </Table.Td>
                  {num(groupYear(g), {
                    strong: true,
                    ta: 'center',
                    pt: ROW_PY + 10,
                    onClick: () => openCell(`type:${g.type}`, g.label, 'total'),
                  })}
                  {Array.from({ length: 12 }, (_, i) =>
                    num(groupMonth(g, i + 1), {
                      strong: true,
                      key: i,
                      pt: ROW_PY + 10,
                      onClick: () => openCell(`type:${g.type}`, g.label, i + 1),
                    }),
                  )}
                </Table.Tr>,
                ...g.sources.map((s) => (
                  <Table.Tr key={s.id}>
                    <Table.Td style={{ paddingTop: ROW_PY, paddingBottom: ROW_PY }}>
                      <Text fz={FS} pl={16} c="dark.4" truncate>
                        {s.name}
                      </Text>
                    </Table.Td>
                    {num(s.total, {
                      ta: 'center',
                      onClick: () => openCell(`src:${s.id}`, s.name, 'total'),
                    })}
                    {Array.from({ length: 12 }, (_, i) =>
                      num(s.months[i + 1] ?? 0, {
                        key: i,
                        onClick: () => openCell(`src:${s.id}`, s.name, i + 1),
                      }),
                    )}
                  </Table.Tr>
                )),
              ])}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
      <CellBreakdownDrawer query={cell?.q ?? null} title={cell?.title ?? ''} onClose={() => setCell(null)} />
    </>
  );
}
