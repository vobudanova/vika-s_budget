import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { round2, toNum } from '@/lib/money';

export type YearRow = { name: string; months: number[]; total: number };
export type YearData = {
  actual: YearRow[];
  accrued: YearRow[];
  actualTotals: number[]; // по месяцам, [0] не используется
  accruedTotals: number[];
  actualYear: number;
  accruedYear: number;
  income: YearRow[];
  incomeTotals: number[];
  incomeYear: number;
  savingsTotals: number[];
  savingsYear: number;
  ksReimbursedYear: number;
  coveredYear: number;
};

async function groupsByMonth(view: string, year: string): Promise<YearRow[]> {
  const res = await db.execute(sql`
    SELECT cg.name, EXTRACT(MONTH FROM v.date)::int AS m, sum(v.amount) AS s
    FROM ${sql.raw(view)} v
    JOIN category_groups cg ON cg.id = v.group_id
    WHERE v.date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}
    GROUP BY cg.name, cg.sort_order, 2
    ORDER BY cg.sort_order
  `);
  const map = new Map<string, number[]>();
  for (const r of res.rows as Array<{ name: string; m: number; s: string }>) {
    if (!map.has(r.name)) map.set(r.name, Array(13).fill(0));
    map.get(r.name)![r.m] = toNum(r.s);
  }
  return [...map.entries()].map(([name, months]) => ({
    name,
    months,
    total: round2(months.reduce((s, v) => s + v, 0)),
  }));
}

export async function getYearData(year: string): Promise<YearData> {
  const [actual, accrued, incomeRes, savingsRes, extraRes] = await Promise.all([
    groupsByMonth('v_expenses_actual', year),
    groupsByMonth('v_expenses_accrued', year),
    db.execute(sql`
      SELECT s.name, EXTRACT(MONTH FROM t.date)::int AS m, sum(t.amount) AS s
      FROM transactions t JOIN income_sources s ON s.id = t.income_source_id
      WHERE t.kind = 'income' AND t.date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}
      GROUP BY s.name, s.sort_order, 2 ORDER BY s.sort_order
    `),
    db.execute(sql`
      SELECT EXTRACT(MONTH FROM date)::int AS m, sum(amount) AS s
      FROM transactions WHERE kind = 'saving' AND date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT
        (SELECT COALESCE(sum(amount), 0) FROM fund_movements
          WHERE kind = 'reimbursement' AND date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}) AS ks,
        (SELECT COALESCE(sum(amount), 0) FROM transactions
          WHERE kind = 'expense' AND covered AND date BETWEEN ${`${year}-01-01`} AND ${`${year}-12-31`}) AS covered
    `),
  ]);

  const incomeMap = new Map<string, number[]>();
  for (const r of incomeRes.rows as Array<{ name: string; m: number; s: string }>) {
    if (!incomeMap.has(r.name)) incomeMap.set(r.name, Array(13).fill(0));
    incomeMap.get(r.name)![r.m] = toNum(r.s);
  }
  const income = [...incomeMap.entries()].map(([name, months]) => ({
    name,
    months,
    total: round2(months.reduce((s, v) => s + v, 0)),
  }));

  const sumRows = (rows: YearRow[]) => {
    const totals = Array(13).fill(0);
    for (const r of rows) for (let m = 1; m <= 12; m++) totals[m] = round2(totals[m] + r.months[m]);
    return totals;
  };

  const savingsTotals = Array(13).fill(0);
  for (const r of savingsRes.rows as Array<{ m: number; s: string }>) {
    savingsTotals[r.m] = toNum(r.s);
  }

  const actualTotals = sumRows(actual);
  const accruedTotals = sumRows(accrued);
  const incomeTotals = sumRows(income);
  const extra = (extraRes.rows as any[])[0];

  return {
    actual,
    accrued,
    actualTotals,
    accruedTotals,
    actualYear: round2(actualTotals.reduce((s, v) => s + v, 0)),
    accruedYear: round2(accruedTotals.reduce((s, v) => s + v, 0)),
    income,
    incomeTotals,
    incomeYear: round2(incomeTotals.reduce((s, v) => s + v, 0)),
    savingsTotals,
    savingsYear: round2(savingsTotals.reduce((s, v) => s + v, 0)),
    ksReimbursedYear: Math.abs(toNum(extra?.ks)),
    coveredYear: toNum(extra?.covered),
  };
}
