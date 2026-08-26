'use client';

import { useLayoutEffect, useRef, useState } from 'react';
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

/** Блоки после «Прочее» — сворачиваемые, по умолчанию свёрнуты. */
const COLLAPSIBLE = new Set(['purchases', 'amortization', 'trips', 'transfers', 'ks', 'savings']);

export type SheetColumn = { key: number; label: string; href?: string; highlight?: boolean };

/** Клик по числу: строка листа + колонка ('total' — столбец Σ). */
export type CellClick = {
  section: string;
  row: string | null;
  col: number | 'total';
  rowTitle: string;
};

const FS = 15;
const CELL_PY = 5; // строки «Начисленные»/«Фактические» (−15%)
const ROW_PY = 3; // заголовки групп
const HEAD_PY = 4; // шапка с числами дней/месяцами (−15%)
const SECTION_GAP = 10; // воздух перед заголовком группы категорий
// строки категорий: −30% высоты, текст по центру; зазор — отдельной
// невидимой строкой-полоской над каждой (не внутри строки)
const CAT_PY = 2;
const CAT_LH = 1.2;
const CAT_GAP = 4;

/** Невидимая узкая полоска над строкой категории: без границ и разделителей. */
export function SpacerRow({ cols }: { cols: number }) {
  return (
    <Table.Tr>
      <Table.Td
        colSpan={cols}
        style={{
          height: CAT_GAP,
          padding: 0,
          border: 'none',
          borderInlineEnd: 'none',
          background: 'var(--mantine-color-white)',
        }}
      />
    </Table.Tr>
  );
}
const HEAD_FZ = 22; // числа дней и названия месяцев (−15%)
const CELL_PX = 14;

const BORDER = 'var(--table-border-color, var(--mantine-color-gray-3))';
/** Нижняя черта фоном: collapsed-граница у sticky-ячейки «отстаёт» от неё при
    прилипании (двойные линии), фон же всегда едет вместе с ячейкой. */
const bottomLineBg = (px: number, bg = 'var(--mantine-color-white)') =>
  `linear-gradient(to top, ${BORDER} ${px}px, ${bg} ${px}px)`;

export function SheetTable({
  columns,
  sections,
  topRows,
  bottomRows,
  minWidth = 900,
  firstColWidth = 230,
  onCell,
  focusCol,
}: {
  columns: SheetColumn[];
  sections: SheetSection[];
  topRows: {
    label: string;
    total: number;
    values: number[];
    muted?: boolean;
    totalBg?: string;
    /** ключ для раскладки ячейки (top-accrued / top-actual) */
    cellKey?: string;
  }[];
  bottomRows?: React.ReactNode;
  minWidth?: number;
  firstColWidth?: number;
  onCell?: (q: CellClick) => void;
  /** колонка, которую при открытии прокрутить в центр (например, сегодняшний день) */
  focusCol?: number;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.filter((s) => COLLAPSIBLE.has(s.key)).map((s) => [s.key, true])),
  );

  // Мобильный UX: при горизонтальной прокрутке залипшая колонка названий
  // сжимается до ~22% экрана, чтобы таблице оставалось место
  const isMobile = useMediaQuery(`(max-width: ${em(768)})`, false);
  const [scrolledX, setScrolledX] = useState(false);
  const shrink = isMobile && scrolledX;

  // Вертикальный скролл живёт внутри таблицы: только так прилипают шапка
  // с числами и строка «Начисленные» (sticky не работает сквозь overflow-x)
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewH, setViewH] = useState<number | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = wrapRef.current;
      if (!el) return;
      setViewH(Math.max(360, window.innerHeight - el.getBoundingClientRect().top - window.scrollY - 20));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Текущий месяц открывается с сегодняшним днём по центру видимой области
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!focusCol) return;
    const vp = viewportRef.current;
    const th = vp?.querySelector<HTMLElement>(`th[data-col="${focusCol}"]`);
    if (!vp || !th) return;
    const stickyW = vp.querySelector('th')?.offsetWidth ?? firstColWidth;
    const target =
      th.offsetLeft + th.offsetWidth / 2 - stickyW - (vp.clientWidth - stickyW) / 2;
    vp.scrollLeft = Math.max(0, target);
    setScrolledX(vp.scrollLeft > 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCol]);

  const firstCol: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    background: 'var(--mantine-color-white)',
    zIndex: 2,
    // граница рисуется тенью: обычный border у sticky-ячейки уезжает под контент
    boxShadow: `1px 0 0 0 ${BORDER}`,
  };

  // min/max-width у ячеек auto-таблицы не работают — ширину колонки задаёт
  // блок-обёртка внутри ячейки (см. FirstCellBox); 2*CELL_PX — паддинги ячейки
  const cellBoxWidth = shrink
    ? `calc(22vw - ${2 * CELL_PX}px)`
    : `${firstColWidth - 2 * CELL_PX}px`;

  const renderTopRow = (r: (typeof topRows)[number], last: boolean, inHead = false) => (
    <Table.Tr key={r.label}>
      <Table.Td
        style={{
          ...firstCol,
          // жирная линия — фоном в каждой ячейке строки (высота совпадает везде),
          // родная межстрочная граница подавляется
          ...(last ? { background: bottomLineBg(2), borderBottomStyle: 'hidden' as const } : null),
        }}
      >
        <FirstCellBox w={cellBoxWidth}>
          <Text fz={FS} fw={r.muted ? 400 : 700} c={r.muted ? 'gray.5' : undefined} truncate>
            {r.label}
          </Text>
        </FirstCellBox>
      </Table.Td>
      <NumCell
        v={r.total}
        strong={!r.muted}
        muted={r.muted}
        ta="center"
        bg={r.totalBg ?? (inHead ? 'var(--mantine-color-white)' : undefined)}
        thickBottom={last}
        onClick={
          onCell && r.cellKey
            ? () => onCell({ section: r.cellKey!, row: null, col: 'total', rowTitle: r.label })
            : undefined
        }
      />
      {columns.map((c) => (
        <NumCell
          key={c.key}
          v={r.values[c.key]}
          strong={!r.muted}
          muted={r.muted}
          ta="center"
          // в прилипающей шапке ячейки непрозрачны — контент не просвечивает
          bg={inHead ? 'var(--mantine-color-white)' : undefined}
          thickBottom={last}
          onClick={
            onCell && r.cellKey
              ? () => onCell({ section: r.cellKey!, row: null, col: c.key, rowTitle: r.label })
              : undefined
          }
        />
      ))}
    </Table.Tr>
  );

  return (
    <Card p={0} ref={wrapRef}>
      <ScrollArea
        type="never"
        h={viewH ?? undefined}
        viewportRef={viewportRef}
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
              <Table.Th style={{ ...firstCol, border: 'none', background: bottomLineBg(1) }} />
              <Table.Th
                style={{
                  minWidth: 108,
                  border: 'none',
                  background: bottomLineBg(1),
                  boxShadow: `inset -1px 0 0 0 ${BORDER}`,
                }}
              />
              {columns.map((c) => (
                <Table.Th
                  key={c.key}
                  data-col={c.key}
                  ta="center"
                  px={CELL_PX}
                  py={HEAD_PY}
                  style={{
                    minWidth: 86,
                    border: 'none',
                    background: bottomLineBg(1, c.highlight ? 'var(--mantine-color-ink-1)' : undefined),
                    boxShadow: `inset -1px 0 0 0 ${BORDER}`,
                  }}
                >
                  {c.href ? (
                    <Text component={Link} href={c.href} fz={HEAD_FZ} fw={600} c="ink.6" td="none" tt="capitalize">
                      {c.label}
                    </Text>
                  ) : (
                    <Text fz={HEAD_FZ} fw={600} c="ink.6" tt="capitalize">
                      {c.label}
                    </Text>
                  )}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {topRows.map((r, i) => renderTopRow(r, i === topRows.length - 1))}

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
                onCell={onCell}
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
  onCell,
}: {
  s: SheetSection;
  columns: SheetColumn[];
  firstCol: React.CSSProperties;
  cellBoxWidth: string;
  shrunk: boolean;
  collapsible: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onCell?: (q: CellClick) => void;
}) {
  // секции визуально разделены: заголовок группы дышит сверху
  const headPad = { paddingTop: ROW_PY + SECTION_GAP, paddingBottom: ROW_PY };
  return (
    <>
      <Table.Tr>
        <Table.Td style={{ ...firstCol, ...headPad }}>
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
        {s.hideTotals ? (
          <>
            <Table.Td style={{ paddingTop: ROW_PY + SECTION_GAP, paddingBottom: ROW_PY }} />
            {columns.map((c) => (
              <Table.Td key={c.key} style={{ paddingTop: ROW_PY + SECTION_GAP, paddingBottom: ROW_PY }} />
            ))}
          </>
        ) : (
          <>
            <NumCell
              v={s.total}
              strong
              ta="center"
              py={ROW_PY}
              pt={ROW_PY + SECTION_GAP}
              onClick={onCell ? () => onCell({ section: s.key, row: null, col: 'total', rowTitle: s.title }) : undefined}
            />
            {columns.map((c) => (
              <NumCell
                key={c.key}
                v={s.dayTotals[c.key]}
                strong
                py={ROW_PY}
                pt={ROW_PY + SECTION_GAP}
                onClick={onCell ? () => onCell({ section: s.key, row: null, col: c.key, rowTitle: s.title }) : undefined}
              />
            ))}
          </>
        )}
      </Table.Tr>
      {!collapsed &&
        s.rows.flatMap((r) => [
          <SpacerRow key={`${r.key}-gap`} cols={columns.length + 2} />,
          <Table.Tr key={r.key}>
            <Table.Td
              style={{
                ...firstCol,
                paddingTop: CAT_PY,
                paddingBottom: CAT_PY,
                lineHeight: CAT_LH,
                verticalAlign: 'middle',
              }}
            >
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
            <NumCell
              v={r.total}
              mutedTotal
              ta="center"
              compact
              onClick={onCell ? () => onCell({ section: s.key, row: r.key, col: 'total', rowTitle: r.name }) : undefined}
            />
            {columns.map((c) => (
              <NumCell
                key={c.key}
                v={r.days[c.key]}
                compact
                onClick={onCell ? () => onCell({ section: s.key, row: r.key, col: c.key, rowTitle: r.name }) : undefined}
              />
            ))}
          </Table.Tr>,
        ])}
    </>
  );
}

export function NumCell({
  v,
  strong,
  muted,
  mutedTotal,
  diff,
  ta = 'right',
  py,
  pt,
  compact,
  bg,
  thickBottom,
  onClick,
}: {
  v: number;
  strong?: boolean;
  muted?: boolean;
  mutedTotal?: boolean;
  diff?: boolean;
  /** дни/месяцы — по правому краю (по умолчанию), столбец Σ — по центру */
  ta?: 'right' | 'center';
  py?: number;
  /** отдельный верхний отступ (воздух перед заголовком секции) */
  pt?: number;
  /** строка категории: −30% высоты, воздух сверху, центр по высоте */
  compact?: boolean;
  bg?: string;
  thickBottom?: boolean;
  /** раскладка ячейки по клику */
  onClick?: () => void;
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
    <Table.Td
      ta={ta}
      className="money"
      fw={strong || diff ? 700 : undefined}
      c={color}
      onClick={onClick}
      style={{
        ...(py !== undefined ? { paddingTop: py, paddingBottom: py } : null),
        ...(pt !== undefined ? { paddingTop: pt } : null),
        ...(compact
          ? { paddingTop: CAT_PY, paddingBottom: CAT_PY, lineHeight: CAT_LH, verticalAlign: 'middle' as const }
          : null),
        ...(bg ? { backgroundColor: bg } : null),
        ...(onClick ? { cursor: 'pointer' } : null),
        // линия фоном, как в первой колонке — иначе высота стыков не совпадает
        ...(thickBottom
          ? {
              borderBottomStyle: 'hidden' as const,
              backgroundImage: `linear-gradient(to top, ${BORDER} 2px, transparent 2px)`,
            }
          : null),
      }}
    >
      {isZero ? '0' : fmtNumber(v, 0)}
    </Table.Td>
  );
}

export type { SheetRow };
