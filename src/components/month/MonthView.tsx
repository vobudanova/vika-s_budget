'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Alert,
  Card,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import type { MonthSheet, SheetSection } from '@/queries/month';
import type { TxRow } from '@/queries/core';
import { TxList } from '@/components/TxList';
import { Money } from '@/components/Money';
import { fmtNumber, fmtMoney } from '@/lib/money';

/** Пастельные подложки принципиально разных блоков. */
const TONE_BG: Record<SheetSection['tone'], string> = {
  plain: 'transparent',
  purchases: '#FFF4E2',
  amortization: '#F1EFFA',
  trips: '#E9F4EF',
  transfers: '#EAF2FB',
  ks: '#FDECEF',
  savings: '#F1F7E8',
};

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

  return (
    <Stack gap="md">
      {sheet.pendingWarnings.length > 0 && (
        <Alert color="red" variant="light" radius="lg" title="Категории, помеченные к удалению, ещё содержат данные">
          <Stack gap={4}>
            {sheet.pendingWarnings.map((w) => (
              <Text key={w.name} fz="sm">
                «{w.groupName} → {w.name}»: {fmtMoney(w.total)} в{' '}
                {w.months.map((m) => m.slice(5, 7)).join(', ')} мес. Перенесите записи — удаление
                станет доступно, когда всё обнулится.
              </Text>
            ))}
          </Stack>
        </Alert>
      )}

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
        <Text fz="sm" c="dimmed">
          начисленные: <Money value={sheet.accruedTotal} fw={600} c="dark.8" /> · фактические:{' '}
          <Money value={sheet.actualTotal} fw={600} c="dark.8" />
        </Text>
      </Group>

      {mode === 'matrix' ? <SheetTable ym={ym} sheet={sheet} today={today} /> : (
        <Card>
          <TxList items={txs} showDate emptyText="За месяц операций нет" />
        </Card>
      )}
      {mode === 'matrix' && (
        <Text fz="xs" c="dimmed">
          Числа в шапке — ссылки на страницу дня; бледно-коралловые колонки — дни, отмеченные
          заполненными. «Начисленные» = траты + амортизация, серые «фактические» = траты + покупки.
        </Text>
      )}
    </Stack>
  );
}

function SheetTable({ ym, sheet, today }: { ym: string; sheet: MonthSheet; today: string }) {
  const days = range(sheet.daysCount);
  const filled = new Set(sheet.filledDays);

  return (
    <Card p={0}>
      <ScrollArea type="auto" offsetScrollbars>
        <Table
          className="sheet"
          fz={13}
          verticalSpacing={7}
          horizontalSpacing={12}
          miw={860}
          stickyHeader
          withColumnBorders
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={firstCol}>Категория</Table.Th>
              <Table.Th ta="right" style={{ minWidth: 88 }}>
                Σ мес
              </Table.Th>
              {days.map((d) => {
                const iso = `${ym}-${String(d).padStart(2, '0')}`;
                const isToday = iso === today;
                return (
                  <Table.Th
                    key={d}
                    ta="center"
                    px={8}
                    style={{ minWidth: 64 }}
                    bg={filled.has(d) ? 'var(--mantine-color-ink-1)' : undefined}
                  >
                    <Text
                      component={Link}
                      href={`/day/${iso}`}
                      fz={13}
                      fw={isToday ? 700 : 600}
                      c={isToday ? 'ink.8' : filled.has(d) ? 'ink.8' : 'dimmed'}
                      td="none"
                    >
                      {d}
                    </Text>
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {/* Две строки итогов: начисленные и фактические (серым) */}
            <Table.Tr>
              <Table.Td style={firstCol}>
                <Text fz={13} fw={700}>
                  Начисленные
                </Text>
              </Table.Td>
              <NumCell v={sheet.accruedTotal} strong />
              {days.map((d) => (
                <NumCell key={d} v={sheet.accruedTotals[d]} strong highlight={filled.has(d)} />
              ))}
            </Table.Tr>
            <Table.Tr>
              <Table.Td style={firstCol}>
                <Text fz={13} c="gray.5">
                  фактические
                </Text>
              </Table.Td>
              <NumCell v={sheet.actualTotal} muted />
              {days.map((d) => (
                <NumCell key={d} v={sheet.actualTotals[d]} muted />
              ))}
            </Table.Tr>

            {sheet.sections.map((s) => (
              <Section key={s.key} s={s} days={days} />
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
}

function Section({ s, days }: { s: SheetSection; days: number[] }) {
  const bg = TONE_BG[s.tone];
  return (
    <>
      <Table.Tr bg={bg === 'transparent' ? 'var(--mantine-color-gray-0)' : bg}>
        <Table.Td style={{ ...firstCol, background: bg === 'transparent' ? 'var(--mantine-color-gray-0)' : bg }}>
          <Text fz={13} fw={700}>
            {s.title}
          </Text>
        </Table.Td>
        <NumCell v={s.total} strong />
        {days.map((d) => (
          <NumCell key={d} v={s.dayTotals[d]} strong />
        ))}
      </Table.Tr>
      {s.rows.map((r) => (
        <Table.Tr key={r.key} bg={bg === 'transparent' ? undefined : bg}>
          <Table.Td style={{ ...firstCol, background: bg === 'transparent' ? 'var(--mantine-color-white)' : bg }}>
            <Text fz={13} pl={14} c={r.pendingDelete ? 'red.7' : 'dark.4'} truncate td={r.pendingDelete ? 'line-through' : undefined}>
              {r.name}
            </Text>
          </Table.Td>
          <NumCell v={r.total} mutedTotal />
          {days.map((d) => (
            <NumCell key={d} v={r.days[d]} />
          ))}
        </Table.Tr>
      ))}
    </>
  );
}

/** Ячейка-число: явные нули бледным, значения тёмным (как в Excel-референсе). */
function NumCell({
  v,
  strong,
  muted,
  mutedTotal,
  highlight,
}: {
  v: number;
  strong?: boolean;
  muted?: boolean;
  mutedTotal?: boolean;
  highlight?: boolean;
}) {
  const isZero = Math.abs(v) < 0.005;
  return (
    <Table.Td
      ta="right"
      className="money"
      fw={strong ? 700 : undefined}
      c={
        muted
          ? 'gray.5'
          : isZero
            ? 'gray.4'
            : mutedTotal
              ? 'gray.6'
              : undefined
      }
      bg={highlight ? 'var(--mantine-color-ink-0)' : undefined}
    >
      {isZero ? '0' : fmtNumber(v, 0)}
    </Table.Td>
  );
}

const firstCol: React.CSSProperties = {
  position: 'sticky',
  left: 0,
  background: 'var(--mantine-color-white)',
  minWidth: 200,
  zIndex: 1,
};

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}
