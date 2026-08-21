import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { daysInMonth, monthEnd, monthStart } from '@/lib/dates';
import { toNum } from '@/lib/money';
import { getReference } from './core';

export type MatrixRow = {
  categoryId: number;
  name: string;
  days: number[]; // 1-индексация по дням, [0] не используется
  total: number;
};
export type MatrixGroup = {
  name: string;
  rows: MatrixRow[];
  dayTotals: number[];
  total: number;
};
export type MonthMatrix = {
  daysCount: number;
  groups: MatrixGroup[];
  dayTotals: number[];
  total: number;
};

async function buildMatrix(
  ym: string,
  view: 'v_expenses_actual' | 'v_expenses_accrued',
  groupNames: string[],
): Promise<MonthMatrix> {
  const [y, m] = ym.split('-').map(Number);
  const daysCount = daysInMonth(y, m);
  const ref = await getReference();

  const res = await db.execute(sql`
    SELECT category_id, EXTRACT(DAY FROM date)::int AS d, sum(amount) AS s
    FROM ${sql.raw(view)}
    WHERE date BETWEEN ${monthStart(ym)} AND ${monthEnd(ym)}
    GROUP BY 1, 2
  `);
  const cells = new Map<string, number>();
  for (const r of res.rows as Array<{ category_id: number; d: number; s: string }>) {
    cells.set(`${r.category_id}:${r.d}`, toNum(r.s));
  }

  const groups: MatrixGroup[] = [];
  const totalDayTotals = Array(daysCount + 1).fill(0);
  let grandTotal = 0;

  for (const gName of groupNames) {
    const g = ref.groups.find((x) => x.name === gName);
    if (!g) continue;
    const cats = ref.categories.filter((c) => c.groupId === g.id);
    const rows: MatrixRow[] = [];
    const dayTotals = Array(daysCount + 1).fill(0);
    let gTotal = 0;
    for (const c of cats) {
      const days = Array(daysCount + 1).fill(0);
      let total = 0;
      for (let d = 1; d <= daysCount; d++) {
        const v = cells.get(`${c.id}:${d}`) ?? 0;
        days[d] = v;
        total += v;
        dayTotals[d] += v;
      }
      if (total !== 0) rows.push({ categoryId: c.id, name: c.name, days, total });
      gTotal += total;
    }
    if (rows.length > 0 || gTotal !== 0) {
      groups.push({ name: g.name, rows, dayTotals, total: gTotal });
      for (let d = 1; d <= daysCount; d++) totalDayTotals[d] += dayTotals[d];
      grandTotal += gTotal;
    }
  }

  return { daysCount, groups, dayTotals: totalDayTotals, total: grandTotal };
}

const ACTUAL_GROUPS = ['Питание', 'Красота', 'Транспорт', 'Бабушки', 'Прочее', 'Покупки', 'Поездки'];
const ACCRUED_GROUPS = ['Питание', 'Красота', 'Транспорт', 'Бабушки', 'Прочее', 'Амортизация', 'Поездки'];

export async function getMonthMatrices(ym: string) {
  const [actual, accrued] = await Promise.all([
    buildMatrix(ym, 'v_expenses_actual', ACTUAL_GROUPS),
    buildMatrix(ym, 'v_expenses_accrued', ACCRUED_GROUPS),
  ]);
  return { actual, accrued };
}
