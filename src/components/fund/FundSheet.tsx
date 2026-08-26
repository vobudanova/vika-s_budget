'use client';

import { useLayoutEffect, useRef, useState, useTransition } from 'react';
import { Card, ScrollArea, Table, Text, Tooltip, em } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { toggleFundMonthClosed } from '@/actions/misc';
import type { FundCategoryStatus } from '@/queries/fund';
import { CellBreakdownDrawer, type CellQuery } from '@/components/sheet/CellBreakdown';
import { RU_MONTHS } from '@/lib/dates';
import { fmtNumber, round2 } from '@/lib/money';

const FS = 15;
const ROW_PY = 3;
const CELL_PX = 12;

const BORDER = 'var(--table-border-color, var(--mantine-color-gray-3))';
const bottomLineBg = (px: number, bg = 'var(--mantine-color-white)') =>
  `linear-gradient(to top, ${BORDER} ${px}px, ${bg} ${px}px)`;

type Agg = {
  key: string;
  name: string;
  catId: number | null; // null — группа/итого
  balance: number;
  prior: number;
  plan: number;
  contrib: number[];
  spent: number[];
  /** месяцы в сроке действия статьи; вне срока ячейки заблокированы (только у строк) */
  active?: boolean[];
};

function aggregate(name: string, key: string, cats: FundCategoryStatus[]): Agg {
  const contrib = Array<number>(13).fill(0);
  const spent = Array<number>(13).fill(0);
  for (const c of cats) {
    for (let m = 1; m <= 12; m++) {
      contrib[m] += c.monthContrib[m];
      spent[m] += c.monthSpent[m];
    }
  }
  return {
    key,
    name,
    catId: null,
    balance: round2(cats.reduce((s, c) => s + c.balance, 0)),
    prior: round2(cats.reduce((s, c) => s + c.priorBalance, 0)),
    plan: round2(cats.reduce((s, c) => s + c.monthlyPlan, 0)),
    contrib,
    spent,
  };
}

/** Лист КС «как в Excel»: статьи по группам × месяцы (отложено/израсходовано). */
export function FundSheet({
  categories,
  year,
  closedMonths,
}: {
  categories: FundCategoryStatus[];
  year: string;
  closedMonths: string[]; // ym, отмеченные «месяц сведён»
}) {
  const [cell, setCell] = useState<{ q: CellQuery; title: string } | null>(null);
  const [, startTransition] = useTransition();
  const toggleClosed = (m: number) =>
    startTransition(() =>
      toggleFundMonthClosed(`${year}-${String(m).padStart(2, '0')}`).then(() => {}),
    );
  const isMobile = useMediaQuery(`(max-width: ${em(768)})`, false);
  const [scrolledX, setScrolledX] = useState(false);
  const shrink = isMobile && scrolledX;

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

  const firstColWidth = 190;

  // таблица открывается с января — автопрокрутку к текущему месяцу убрали
  const viewportRef = useRef<HTMLDivElement>(null);

  const groups = [...new Set(categories.map((c) => c.groupName))];

  const firstCol: React.CSSProperties = {
    position: 'sticky',
    left: 0,
    background: 'var(--mantine-color-white)',
    zIndex: 2,
    boxShadow: `1px 0 0 0 ${BORDER}`,
  };
  const cellBoxWidth = shrink ? `calc(22vw - ${2 * CELL_PX}px)` : `${firstColWidth - 2 * CELL_PX}px`;

  const openCell = (side: 'in' | 'out', catId: number | null, name: string, m: number | 'total') => {
    const from = m === 'total' ? `${year}-01-01` : `${year}-${String(m).padStart(2, '0')}-01`;
    const to =
      m === 'total'
        ? `${year}-12-31`
        : `${year}-${String(m).padStart(2, '0')}-${new Date(Number(year), m, 0).getDate()}`;
    setCell({
      q: { from, to, section: side === 'in' ? 'fund-in' : 'ks', row: catId ? String(catId) : null },
      title: `${name} · ${side === 'in' ? 'отложено' : 'израсходовано'} · ${
        m === 'total' ? year : RU_MONTHS[m - 1].toLowerCase()
      }`,
    });
  };

  return (
    <>
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
            verticalSpacing={ROW_PY}
            horizontalSpacing={CELL_PX}
            miw={2150}
            stickyHeader
            withColumnBorders
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th rowSpan={2} style={{ ...firstCol, border: 'none', background: bottomLineBg(1) }} />
                <HeadTh rowSpan={2} w={96}>
                  сальдо
                </HeadTh>
                <HeadTh rowSpan={2} w={96}>
                  остаток с прошлых лет
                </HeadTh>
                <HeadTh rowSpan={2} w={84}>
                  план/мес
                </HeadTh>
                {RU_MONTHS.map((mName, i) => {
                  const closed = closedMonths.includes(`${year}-${String(i + 1).padStart(2, '0')}`);
                  return (
                    <HeadTh
                      key={mName}
                      colSpan={2}
                      accent
                      dataCol={i + 1}
                      closed={closed}
                      onClick={() => toggleClosed(i + 1)}
                    >
                      {mName.slice(0, 3)}
                    </HeadTh>
                  );
                })}
              </Table.Tr>
              <Table.Tr>
                {RU_MONTHS.map((mName) => [
                  <HeadTh key={`${mName}-in`} w={78} sub>
                    отл.
                  </HeadTh>,
                  <HeadTh key={`${mName}-out`} w={78} sub>
                    израсх.
                  </HeadTh>,
                ])}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <FundRow
                a={aggregate('итого', 'total', categories)}
                kind="total"
                firstCol={firstCol}
                cellBoxWidth={cellBoxWidth}
                shrink={shrink}
                openCell={openCell}
              />
              {groups.map((g) => {
                const rows = categories.filter((c) => c.groupName === g);
                return [
                  <FundRow
                    key={`g-${g}`}
                    a={aggregate(g, `g-${g}`, rows)}
                    kind="group"
                    firstCol={firstCol}
                    cellBoxWidth={cellBoxWidth}
                    shrink={shrink}
                    openCell={openCell}
                  />,
                  ...rows.flatMap((c) => [
                    <Table.Tr key={`gap-${c.id}`}>
                      <Table.Td
                        colSpan={28}
                        style={{ height: 4, padding: 0, border: 'none', background: 'var(--mantine-color-white)' }}
                      />
                    </Table.Tr>,
                    <FundRow
                      key={c.id}
                      a={{
                        key: String(c.id),
                        name: c.name,
                        catId: c.id,
                        balance: c.balance,
                        prior: c.priorBalance,
                        plan: c.monthlyPlan,
                        contrib: c.monthContrib,
                        spent: c.monthSpent,
                        active: c.activeMonths,
                      }}
                      kind="row"
                      firstCol={firstCol}
                      cellBoxWidth={cellBoxWidth}
                      shrink={shrink}
                      openCell={openCell}
                    />,
                  ]),
                ];
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
      <CellBreakdownDrawer query={cell?.q ?? null} title={cell?.title ?? ''} onClose={() => setCell(null)} />
    </>
  );
}

function HeadTh({
  children,
  w,
  rowSpan,
  colSpan,
  accent,
  sub,
  dataCol,
  closed,
  onClick,
}: {
  children?: React.ReactNode;
  w?: number;
  rowSpan?: number;
  colSpan?: number;
  accent?: boolean;
  sub?: boolean;
  dataCol?: number;
  closed?: boolean;
  onClick?: () => void;
}) {
  const th = (
    <Table.Th
      ta="center"
      rowSpan={rowSpan}
      colSpan={colSpan}
      data-col={dataCol}
      onClick={onClick}
      style={{
        minWidth: w,
        border: 'none',
        background: bottomLineBg(1, closed ? 'var(--mantine-color-ink-1)' : undefined),
        boxShadow: `inset -1px 0 0 0 ${BORDER}`,
        whiteSpace: 'normal',
        ...(onClick ? { cursor: 'pointer' } : null),
      }}
    >
      <Text fz={accent ? 22 : 12} fw={600} c={accent ? 'ink.6' : 'dimmed'} lh={1.15} tt={sub ? undefined : undefined}>
        {children}
      </Text>
    </Table.Th>
  );
  if (!onClick) return th;
  return (
    <Tooltip
      label={closed ? 'Месяц сведён — нажмите, чтобы снять отметку' : 'Нажмите, когда месяц КС сведён'}
      openDelay={400}
    >
      {th}
    </Tooltip>
  );
}

function FundRow({
  a,
  kind,
  firstCol,
  cellBoxWidth,
  shrink,
  openCell,
}: {
  a: Agg;
  kind: 'total' | 'group' | 'row';
  firstCol: React.CSSProperties;
  cellBoxWidth: string;
  shrink: boolean;
  openCell: (side: 'in' | 'out', catId: number | null, name: string, m: number | 'total') => void;
}) {
  const strong = kind !== 'row';
  // группы разделены воздухом перед заголовком; строки статей — компактные,
  // по центру; зазор над ними — отдельной невидимой строкой в FundSheet
  const padTop = kind === 'group' ? ROW_PY + 10 : kind === 'row' ? 2 : ROW_PY;
  const padBottom = kind === 'row' ? 2 : ROW_PY;
  const rowStyle =
    kind === 'row' ? ({ lineHeight: 1.2, verticalAlign: 'middle' } as const) : ({} as const);
  const cell = (v: number, side: 'in' | 'out', m: number) => {
    const isZero = Math.abs(v) < 0.005;
    const blocked = !!a.active && !a.active[m];
    if (blocked) {
      // вне срока действия статьи: без кликов, серая заливка; ненулевые
      // импортные значения всё же показываем
      return (
        <Table.Td
          key={`${side}${m}`}
          ta="right"
          className="money"
          c="gray.4"
          title="Вне срока действия статьи"
          style={{
            paddingTop: padTop,
            paddingBottom: padBottom,
            background: 'var(--mantine-color-gray-0)',
            ...rowStyle,
          }}
        >
          {isZero ? '' : fmtNumber(v, 0)}
        </Table.Td>
      );
    }
    return (
      <Table.Td
        key={`${side}${m}`}
        ta="right"
        className="money"
        fw={strong ? 700 : undefined}
        c={isZero ? 'gray.4' : side === 'out' ? 'gray.7' : undefined}
        onClick={() => openCell(side, a.catId, a.name, m)}
        style={{ paddingTop: padTop, paddingBottom: padBottom, cursor: 'pointer', ...rowStyle }}
      >
        {isZero ? '0' : fmtNumber(v, 0)}
      </Table.Td>
    );
  };
  const svc = (v: number, opts?: { strong?: boolean; muted?: boolean }) => {
    const isZero = Math.abs(v) < 0.005;
    return (
      <Table.Td
        ta="right"
        className="money"
        fw={opts?.strong ? 700 : undefined}
        c={isZero ? 'gray.4' : v < 0 ? 'red.8' : opts?.muted ? 'gray.6' : undefined}
        style={{ paddingTop: padTop, paddingBottom: padBottom, ...rowStyle }}
      >
        {isZero ? '0' : fmtNumber(v, 0)}
      </Table.Td>
    );
  };
  return (
    <Table.Tr>
      <Table.Td style={{ ...firstCol, paddingTop: padTop, paddingBottom: padBottom, ...rowStyle }}>
        <div style={{ width: cellBoxWidth, overflow: 'hidden', transition: 'width 160ms ease' }}>
          <Text
            fz={FS}
            fw={strong ? 700 : 400}
            pl={kind === 'row' && !shrink ? 16 : 0}
            c={kind === 'row' ? 'dark.4' : undefined}
            truncate
          >
            {a.name}
          </Text>
        </div>
      </Table.Td>
      {svc(a.balance, { strong: true })}
      {svc(a.prior, { muted: true })}
      {svc(a.plan, { muted: true })}
      {Array.from({ length: 12 }, (_, i) => i + 1).flatMap((m) => [
        cell(a.contrib[m], 'in', m),
        cell(a.spent[m], 'out', m),
      ])}
    </Table.Tr>
  );
}
