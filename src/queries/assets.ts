import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { todayISO } from '@/lib/dates';
import { toNum } from '@/lib/money';

export type AssetOverview = {
  id: number;
  name: string;
  categoryName: string;
  purchaseDate: string;
  initialPrice: number;
  effectivePrice: number;
  termMonths: number;
  disposedAt: string | null;
  monthlyAmount: number;
  prevYears: number; // начислений в прошлых годах
  currentYear: number; // начислений в текущем году (до сегодня)
  future: number; // оставшихся начислений (после сегодня)
  accruedToDate: number;
  lastAccrualDate: string | null;
  goalId: number | null;
  goalTarget: number | null;
  goalContributed: number | null;
  goalSpentAt: string | null;
  note: string | null;
};

export async function getAssetsOverview(): Promise<AssetOverview[]> {
  const today = todayISO();
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const res = await db.execute(sql`
    SELECT
      a.id, a.name, a.purchase_date, a.initial_price, a.term_months, a.disposed_at, a.note,
      ac.name AS category_name,
      a.initial_price + COALESCE(adj.s, 0) AS effective_price,
      COALESCE(st.prev_years, 0) AS prev_years,
      COALESCE(st.current_year, 0) AS current_year,
      COALESCE(st.future, 0) AS future,
      COALESCE(st.accrued, 0) AS accrued,
      st.last_date AS last_accrual_date,
      g.id AS goal_id,
      g.target_amount AS goal_target,
      g.spent_at AS goal_spent_at,
      gm.s AS goal_contributed
    FROM assets a
    JOIN asset_categories ac ON ac.id = a.asset_category_id
    LEFT JOIN LATERAL (
      SELECT sum(amount) AS s FROM asset_adjustments WHERE asset_id = a.id
    ) adj ON true
    LEFT JOIN LATERAL (
      SELECT
        count(*) FILTER (WHERE accrual_date < ${yearStart}) AS prev_years,
        count(*) FILTER (WHERE accrual_date >= ${yearStart} AND accrual_date <= ${today}) AS current_year,
        count(*) FILTER (WHERE accrual_date > ${today}) AS future,
        sum(amount) FILTER (WHERE accrual_date <= ${today}) AS accrued,
        max(accrual_date) AS last_date
      FROM amortization_accruals WHERE asset_id = a.id
    ) st ON true
    LEFT JOIN cap_goals g ON g.asset_id = a.id
    LEFT JOIN LATERAL (
      SELECT sum(amount) AS s FROM cap_movements WHERE cap_goal_id = g.id
    ) gm ON true
    ORDER BY ac.sort_order, a.purchase_date DESC
  `);
  return (res.rows as any[]).map((r) => {
    const effectivePrice = toNum(r.effective_price);
    return {
      id: Number(r.id),
      name: r.name,
      categoryName: r.category_name,
      purchaseDate: r.purchase_date,
      initialPrice: toNum(r.initial_price),
      effectivePrice,
      termMonths: r.term_months,
      disposedAt: r.disposed_at,
      monthlyAmount: r.term_months ? Math.round((effectivePrice / r.term_months) * 100) / 100 : 0,
      prevYears: Number(r.prev_years),
      currentYear: Number(r.current_year),
      future: Number(r.future),
      accruedToDate: toNum(r.accrued),
      lastAccrualDate: r.last_accrual_date,
      goalId: r.goal_id ? Number(r.goal_id) : null,
      goalTarget: r.goal_target ? toNum(r.goal_target) : null,
      goalContributed: r.goal_contributed ? toNum(r.goal_contributed) : null,
      goalSpentAt: r.goal_spent_at,
      note: r.note,
    };
  });
}
