'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { Card, ScrollArea, Table, Text, em } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
export function FundSheet({ categories, year }: { categories: FundCategoryStatus[]; year: string }) {
  const [cell, setCell] = useState<{ q: CellQuery; title: string } | null>(null);
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

  // текущий год открывается с текущим месяцем по центру видимой зоны
  const viewportRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const now = new Date();
    if (String(now.getFullYear()) !== year) return;
    const vp = viewportRef.current;
    const th = vp?.querySelector<HTMLElement>(`th[data-col="${now.getMonth() + 1}"]`);
    if (!vp || !th) return;
    const stickyW = vp.querySelector('th')?.offsetWidth ?? firstColWidth;
    const target = th.offsetLeft + th.offsetWidth / 2 - stickyW - (vp.clientWidth - stickyW) / 2;
    vp.scrollLeft = Math.max(0, target);
    setScrolledX(vp.scrollLeft > 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

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
                {RU_MONTHS.map((mName, i) => (
                  <HeadTh key={mName} colSpan={2} accent dataCol={i + 1}>
                    {mName.slice(0, 3)}
                  </HeadTh>
                ))}
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
                  ...rows.map((c) => (
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
                      }}
                      kind="row"
                      firstCol={firstCol}
                      cellBoxWidth={cellBoxWidth}
                      shrink={shrink}
                      openCell={openCell}
                    />
                  )),
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
}: {
  children?: React.ReactNode;
  w?: number;
  rowSpan?: number;
  colSpan?: number;
  accent?: boolean;
  sub?: boolean;
  dataCol?: number;
}) {
  return (
    <Table.Th
      ta="center"
      rowSpan={rowSpan}
      colSpan={colSpan}
      data-col={dataCol}
      style={{
        minWidth: w,
        border: 'none',
        background: bottomLineBg(1),
        boxShadow: `inset -1px 0 0 0 ${BORDER}`,
        whiteSpace: 'normal',
      }}
    >
      <Text fz={accent ? 22 : 12} fw={600} c={accent ? 'ink.6' : 'dimmed'} lh={1.15} tt={sub ? undefined : undefined}>
        {children}
      </Text>
    </Table.Th>
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
  const cell = (v: number, side: 'in' | 'out', m: number) => {
    const isZero = Math.abs(v) < 0.005;
    return (
      <Table.Td
        key={`${side}${m}`}
        ta="right"
        className="money"
        fw={strong ? 700 : undefined}
        c={isZero ? 'gray.4' : side === 'out' ? 'gray.7' : undefined}
        onClick={() => openCell(side, a.catId, a.name, m)}
        style={{ paddingTop: ROW_PY, paddingBottom: ROW_PY, cursor: 'pointer' }}
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
        style={{ paddingTop: ROW_PY, paddingBottom: ROW_PY }}
      >
        {isZero ? '0' : fmtNumber(v, 0)}
      </Table.Td>
    );
  };
  return (
    <Table.Tr>
      <Table.Td style={{ ...firstCol, paddingTop: ROW_PY, paddingBottom: ROW_PY }}>
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
