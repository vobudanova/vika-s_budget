import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { round2, toNum } from '@/lib/money';

export type FundCategoryStatus = {
  id: number;
  name: string;
  groupName: string;
  monthlyPlan: number;
  openingBalance: number;
  contributedYtd: number;
  spentYtd: number;
  balance: number;
};

export type FundMovementRow = {
  id: number;
  date: string;
  amount: number;
  kind: string;
  settle: string | null;
  offsetAppliedAt: string | null;
  categoryName: string;
  note: string | null;
};

export type FundOverview = {
  categories: FundCategoryStatus[];
  totalBalance: number;
  planTotal: number;
  pendingOffsets: { id: number; amount: number; categoryName: string; date: string; note: string | null }[];
  pendingOffsetsTotal: number;
  nextTopupAmount: number;
  ksAccountBalance: number;
  allocationsNet: number;
  reconciliationDiff: number;
  recentMovements: FundMovementRow[];
};

export async function getFundOverview(year: string): Promise<FundOverview> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const catsRes = await db.execute(sql`
    SELECT fc.id, fc.name, fc.group_name, fc.monthly_plan, fc.opening_balance,
           COALESCE(m.total, 0) AS total,
           COALESCE(m.contributed_ytd, 0) AS contributed_ytd,
           COALESCE(m.spent_ytd, 0) AS spent_ytd
    FROM fund_categories fc
    LEFT JOIN LATERAL (
      SELECT
        sum(amount) AS total,
        sum(amount) FILTER (WHERE amount > 0 AND date BETWEEN ${yearStart} AND ${yearEnd}) AS contributed_ytd,
        sum(-amount) FILTER (WHERE amount < 0 AND date BETWEEN ${yearStart} AND ${yearEnd}) AS spent_ytd
      FROM fund_movements WHERE fund_category_id = fc.id
    ) m ON true
    WHERE fc.active_to IS NULL OR fc.active_to >= ${yearStart}
    ORDER BY fc.sort_order
  `);

  const categories: FundCategoryStatus[] = (catsRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    groupName: r.group_name,
    monthlyPlan: toNum(r.monthly_plan),
    openingBalance: toNum(r.opening_balance),
    contributedYtd: toNum(r.contributed_ytd),
    spentYtd: toNum(r.spent_ytd),
    balance: round2(toNum(r.opening_balance) + toNum(r.total)),
  }));

  const totalBalance = round2(categories.reduce((s, c) => s + c.balance, 0));
  const planTotal = round2(categories.reduce((s, c) => s + c.monthlyPlan, 0));

  const offsetsRes = await db.execute(sql`
    SELECT fm.id, fm.amount, fm.date, fm.note, fc.name AS category_name
    FROM fund_movements fm
    JOIN fund_categories fc ON fc.id = fm.fund_category_id
    WHERE fm.kind = 'reimbursement' AND fm.settle = 'offset_next_topup' AND fm.offset_applied_at IS NULL
    ORDER BY fm.date
  `);
  const pendingOffsets = (offsetsRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    amount: Math.abs(toNum(r.amount)),
    categoryName: r.category_name,
    date: r.date,
    note: r.note,
  }));
  const pendingOffsetsTotal = round2(pendingOffsets.reduce((s, o) => s + o.amount, 0));
  const nextTopupAmount = round2(planTotal - pendingOffsetsTotal);

  const balRes = await db.execute(sql`
    SELECT COALESCE(sum(balance), 0) AS s FROM v_account_balances WHERE type = 'savings_ks'
  `);
  const ksAccountBalance = toNum((balRes.rows as any[])[0]?.s);

  const allocRes = await db.execute(sql`
    SELECT
      COALESCE(sum(amount) FILTER (WHERE a.type = 'savings_ks'), 0) AS out_sum,
      COALESCE(sum(amount) FILTER (WHERE ca.type = 'savings_ks'), 0) AS back_sum
    FROM transactions t
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ca ON ca.id = t.counter_account_id
    WHERE t.fund_allocation = 'ks'
  `);
  const alloc = (allocRes.rows as any[])[0];
  const allocationsNet = round2(toNum(alloc?.out_sum) - toNum(alloc?.back_sum));

  // Сверка: остатки статей = счёт КС + размещения + «зачёты в пути»
  // (зачтённые компенсации уже вычтены из статей, но ещё не сняты со счёта)
  const reconciliationDiff = round2(
    totalBalance - (ksAccountBalance + allocationsNet - pendingOffsetsTotal),
  );

  const recentRes = await db.execute(sql`
    SELECT fm.id, fm.date, fm.amount, fm.kind, fm.settle, fm.offset_applied_at, fm.note,
           fc.name AS category_name
    FROM fund_movements fm
    JOIN fund_categories fc ON fc.id = fm.fund_category_id
    ORDER BY fm.date DESC, fm.id DESC
    LIMIT 25
  `);
  const recentMovements = (recentRes.rows as any[]).map((r) => ({
    id: Number(r.id),
    date: r.date,
    amount: toNum(r.amount),
    kind: r.kind,
    settle: r.settle,
    offsetAppliedAt: r.offset_applied_at,
    categoryName: r.category_name,
    note: r.note,
  }));

  return {
    categories,
    totalBalance,
    planTotal,
    pendingOffsets,
    pendingOffsetsTotal,
    nextTopupAmount,
    ksAccountBalance,
    allocationsNet,
    reconciliationDiff,
    recentMovements,
  };
}
