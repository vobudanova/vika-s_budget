'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ActionIcon,
  Card,
  Group,
  ScrollArea,
  Table,
  Text,
  Tooltip,
  UnstyledButton,
  em,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconChevronRight, IconTrash } from '@tabler/icons-react';
import type { SheetSection, SheetRow } from '@/queries/month';
import { fmtNumber } from '@/lib/money';

/** Цветом выделяются только строки-родители особых блоков; траты остаются нейтральными. */
export const TONE_HEADER_BG: Record<SheetSection['tone'], string> = {
  plain: 'transparent',
  purchases: '#FFE7C2',
  amortization: '#E4DFF6',
  trips: '#D8EDE3',
  transfers: '#D9E8F8',
  ks: '#FBDCE2',
  savings: '#E4F0D2',
};

/** Блоки после «Прочее» — сворачиваемые, по умолчанию свёрнуты. */
const COLLAPSIBLE = new Set(['purchases', 'amortization', 'trips', 'transfers', 'ks', 'savings']);

export type SheetColumn = { key: number; label: string; href?: string; highlight?: boolean };

const FS = 15; // базовый кегль (+15% к прежним 13)
const CELL_PY = 6;
const CELL_PX = 14;

export function SheetTable({
  columns,
  sections,
  topRows,
  bottomRows,
  minWidth = 900,
  firstColWidth = 230,
}: {
  columns: SheetColumn[];
  sections: SheetSection[];
  topRows: { label: string; total: number; values: number[]; muted?: boolean }[];
  bottomRows?: React.ReactNode;
  minWidth?: number;
  firstColWidth?: number;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.filter((s) => COLLAPSIBLE.has(s.key)).map((s) => [s.key, true])),
  );

  // Мобильный UX: при горизонтальной прокрутке залипшая колонка названий
  // сжимается до ~22% экрана, чтобы таблице оставалось место
  const isMobile = useMediaQuery(`(max-width: ${em(768)})`, false);
  const [scrolledX, setScrolledX] = useState(false);
  const shrink = isMobile && scrolledX;

  const firstCol: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    background: 'var(--mantine-color-white)',
    zIndex: 2,
    // граница рисуется тенью: обычный border у sticky-ячейки уезжает под контент
    boxShadow: '1px 0 0 0 var(--table-border-color, var(--mantine-color-gray-3))',
  };

  // min/max-width у ячеек auto-таблицы не работают — ширину колонки задаёт
  // блок-обёртка внутри ячейки (см. FirstCellBox); 2*CELL_PX — паддинги ячейки
  const cellBoxWidth = shrink
    ? `calc(22vw - ${2 * CELL_PX}px)`
    : `${firstColWidth - 2 * CELL_PX}px`;

  return (
    <Card p={0}>
      <ScrollArea
        type="auto"
        offsetScrollbars
        onScrollPositionChange={({ x }) => setScrolledX(x > 8)}
      >
        <Table
          className="sheet"
          fz={FS}
          verticalSpacing={CELL_PY}
          horizontalSpacing={CELL_PX}
          miw={minWidth}
          stickyHeader
          withColumnBorders
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th
                style={{
                  ...firstCol,
                  // нижняя черта тоже тенью: у sticky-ячейки collapsed-граница не рисуется
                  boxShadow:
                    '1px 0 0 0 var(--table-border-color, var(--mantine-color-gray-3)), inset 0 -1px 0 0 var(--table-border-color, var(--mantine-color-gray-3))',
                }}
              />
              <Table.Th style={{ minWidth: 108 }} />
              {columns.map((c) => (
                <Table.Th
                  key={c.key}
                  ta="center"
                  px={CELL_PX}
                  style={{ minWidth: 86 }}
                  bg={c.highlight ? 'var(--mantine-color-ink-1)' : undefined}
                >
                  {c.href ? (
                    <Text component={Link} href={c.href} fz={26} fw={600} c="ink.6" td="none">
                      {c.label}
                    </Text>
                  ) : (
                    <Text fz={26} fw={600} c="ink.6" tt="capitalize">
                      {c.label}
                    </Text>
                  )}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {topRows.map((r) => (
              <Table.Tr key={r.label}>
                <Table.Td style={firstCol}>
                  <FirstCellBox w={cellBoxWidth}>
                    <Text fz={FS} fw={r.muted ? 400 : 700} c={r.muted ? 'gray.5' : undefined} truncate>
                      {r.label}
                    </Text>
                  </FirstCellBox>
                </Table.Td>
                <NumCell v={r.total} strong={!r.muted} muted={r.muted} />
                {columns.map((c) => (
                  <NumCell key={c.key} v={r.values[c.key]} strong={!r.muted} muted={r.muted} />
                ))}
              </Table.Tr>
            ))}

            {sections.map((s) => (
              <Section
                key={s.key}
                s={s}
                columns={columns}
                firstCol={firstCol}
                cellBoxWidth={cellBoxWidth}
                shrunk={shrink}
                collapsible={COLLAPSIBLE.has(s.key)}
                collapsed={!!collapsed[s.key]}
                onToggle={() => setCollapsed((p) => ({ ...p, [s.key]: !p[s.key] }))}
              />
            ))}
            {bottomRows}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );
}

function FirstCellBox({ w, children }: { w: string; children: React.ReactNode }) {
  return (
    <div style={{ width: w, overflow: 'hidden', transition: 'width 160ms ease' }}>{children}</div>
  );
}

function Section({
  s,
  columns,
  firstCol,
  cellBoxWidth,
  shrunk,
  collapsible,
  collapsed,
  onToggle,
}: {
  s: SheetSection;
  columns: SheetColumn[];
  firstCol: React.CSSProperties;
  cellBoxWidth: string;
  shrunk: boolean;
  collapsible: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const headerBg = TONE_HEADER_BG[s.tone];
  return (
    <>
      <Table.Tr bg={headerBg === 'transparent' ? undefined : headerBg}>
        <Table.Td
          style={{
            ...firstCol,
            background: headerBg === 'transparent' ? 'var(--mantine-color-white)' : headerBg,
          }}
        >
          <FirstCellBox w={cellBoxWidth}>
            {collapsible ? (
              <UnstyledButton onClick={onToggle} style={{ display: 'block', width: '100%' }}>
                <Group gap={6} wrap="nowrap">
                  <IconChevronRight
                    size={15}
                    stroke={2.2}
                    style={{
                      transform: collapsed ? 'none' : 'rotate(90deg)',
                      transition: 'transform 140ms ease',
                      flexShrink: 0,
                    }}
                  />
                  <Text fz={FS} fw={700} truncate>
                    {s.title}
                  </Text>
                </Group>
              </UnstyledButton>
            ) : (
              <Text fz={FS} fw={700} truncate>
                {s.title}
              </Text>
            )}
          </FirstCellBox>
        </Table.Td>
        <NumCell v={s.total} strong />
        {columns.map((c) => (
          <NumCell key={c.key} v={s.dayTotals[c.key]} strong />
        ))}
      </Table.Tr>
      {!collapsed &&
        s.rows.map((r) => (
          <Table.Tr key={r.key}>
            <Table.Td style={firstCol}>
              <FirstCellBox w={cellBoxWidth}>
                <Group gap={6} wrap="nowrap">
                  <Text
                    fz={FS}
                    pl={shrunk ? 0 : collapsible ? 27 : 16}
                    c={r.pendingDelete ? 'red.7' : 'dark.4'}
                    truncate
                    td={r.pendingDelete ? 'line-through' : undefined}
                  >
                    {r.name}
                  </Text>
                  {r.pendingDelete && Math.abs(r.total) < 0.005 && r.onDelete && (
                    <Tooltip label="Удалить навсегда (данных не осталось)">
                      <ActionIcon size="xs" color="red" variant="subtle" onClick={r.onDelete}>
                        <IconTrash size={13} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Group>
              </FirstCellBox>
            </Table.Td>
            <NumCell v={r.total} mutedTotal />
            {columns.map((c) => (
              <NumCell key={c.key} v={r.days[c.key]} />
            ))}
          </Table.Tr>
        ))}
    </>
  );
}

export function NumCell({
  v,
  strong,
  muted,
  mutedTotal,
  diff,
}: {
  v: number;
  strong?: boolean;
  muted?: boolean;
  mutedTotal?: boolean;
  diff?: boolean;
}) {
  const isZero = Math.abs(v) < 0.005;
  const color = diff
    ? isZero
      ? 'gray.4'
      : v > 0
        ? 'teal.8'
        : 'red.8'
    : muted
      ? 'gray.5'
      : isZero
        ? 'gray.4'
        : mutedTotal
          ? 'gray.6'
          : undefined;
  return (
    <Table.Td ta="center" className="money" fw={strong || diff ? 700 : undefined} c={color}>
      {isZero ? '0' : fmtNumber(v, 0)}
    </Table.Td>
  );
}

export type { SheetRow };
