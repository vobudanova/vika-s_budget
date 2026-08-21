import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { monthEnd, monthStart } from '@/lib/dates';
import { round2, toNum } from '@/lib/money';
import { getCapOverview } from './cap';
import { getFundOverview } from './fund';

export type Forecast = {
  capByCategory: { category: string; amount: number; goals: string[] }[];
  capTotal: number;
  amortizationTotal: number;
  fundPlanTotal: number;
  fundOffsets: number;
  fundToTransfer: number;
  expectedIncome: { name: string; amount: number }[];
  expectedIncomeTotal: number;
};

/** Прогноз на месяц ym: всё вычисляется, ничего не вводится. */
export async function getForecast(ym: string): Promise<Forecast> {
  const [cap, fund, amortRes, incomeRes] = await Promise.all([
    getCapOverview(),
    getFundOverview(ym.slice(0, 4)),
    db.execute(sql`
      SELECT COALESCE(sum(amount), 0) AS s
      FROM amortization_accruals
      WHERE accrual_date BETWEEN ${monthStart(ym)} AND ${monthEnd(ym)}
    `),
    db.execute(sql`
      SELECT name, expected_monthly FROM income_sources
      WHERE is_active AND expected_monthly IS NOT NULL AND expected_monthly > 0
      ORDER BY sort_order
    `),
  ]);

  const activeGoals = cap.goals.filter(
    (g) => !['spent', 'waiting', 'ready'].includes(g.status) && g.remaining > 0,
  );
  const byCat = new Map<string, { amount: number; goals: string[] }>();
  for (const g of activeGoals) {
    const cat = g.assetCategoryName ?? 'Прочее';
    const cur = byCat.get(cat) ?? { amount: 0, goals: [] };
    cur.amount = round2(cur.amount + Math.min(g.monthly, g.remaining));
    cur.goals.push(g.name);
    byCat.set(cat, cur);
  }
  const capByCategory = [...byCat.entries()].map(([category, v]) => ({
    category,
    amount: v.amount,
    goals: v.goals,
  }));
  const capTotal = round2(capByCategory.reduce((s, c) => s + c.amount, 0));

  const expectedIncome = (incomeRes.rows as any[]).map((r) => ({
    name: r.name as string,
    amount: toNum(r.expected_monthly),
  }));

  return {
    capByCategory,
    capTotal,
    amortizationTotal: toNum((amortRes.rows as any[])[0]?.s),
    fundPlanTotal: fund.planTotal,
    fundOffsets: fund.pendingOffsetsTotal,
    fundToTransfer: fund.nextTopupAmount,
    expectedIncome,
    expectedIncomeTotal: round2(expectedIncome.reduce((s, i) => s + i.amount, 0)),
  };
}
