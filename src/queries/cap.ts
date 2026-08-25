import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { monthEnd, monthsBetweenInclusive, todayISO, ymAdd, ymOf } from '@/lib/dates';
import { round2, toNum } from '@/lib/money';
import { getSetting } from '@/queries/core';

export type CapStatus = 'not_started' | 'in_progress' | 'behind' | 'waiting' | 'ready' | 'spent';

export type CapGoalOverview = {
  id: number;
  name: string;
  target: number;
  monthly: number;
  termMonths: number;
  contributed: number;
  remaining: number;
  status: CapStatus;
  behindAmount: number;
  waitUntil: string | null; // конец месяца последнего взноса
  monthsFlags: Record<string, { amount: number; sent: boolean; inflow: number }>; // ym -> взнос + перетоки
  spentAt: string | null;
  assetId: number | null;
  assetCategoryName: string | null;
  firstOwnYm: string | null;
  /** дата начала амортизации (день покупки актива) */
  startDate: string | null;
};

export type CapOverview = {
  goals: CapGoalOverview[];
  pendingPayment: { goalId: number; name: string; amount: number; monthsCount: number }[];
  pendingTotal: number;
  ledgerTotal: number;
  capAccountsBalance: number;
  allocationsNet: number;
  reconciliationDiff: number;
};

export async function getCapOverview(): Promise<CapOverview> {
  const today = todayISO();
  const currentYm = ymOf(today);
  const year = today.slice(0, 4);

  const goalsRes = await db.execute(sql`
    SELECT g.id, g.name, g.target_amount, g.monthly_contribution, g.term_months, g.spent_at, g.asset_id,
           ac.name AS asset_category_name, a.purchase_date AS asset_purchase_date
    FROM cap_goals g
    LEFT JOIN assets a ON a.id = g.asset_id
    LEFT JOIN asset_categories ac ON ac.id = a.asset_category_id
    ORDER BY g.created_at
  `);

  const movementsRes = await db.execute(sql`
    SELECT cap_goal_id, date, amount, source, transaction_id
    FROM cap_movements
    ORDER BY date
  `);
  const movements = (movementsRes.rows as any[]).map((m) => ({
    goalId: Number(m.cap_goal_id),
    date: m.date as string,
    amount: toNum(m.amount),
    source: m.source as string,
    transactionId: m.transaction_id ? Number(m.transaction_id) : null,
  }));

  const goals: CapGoalOverview[] = (goalsRes.rows as any[]).map((g) => {
    const id = Number(g.id);
    const target = toNum(g.target_amount);
    const monthly = toNum(g.monthly_contribution);
    const mine = movements.filter((m) => m.goalId === id);
    const contributed = round2(mine.reduce((s, m) => s + m.amount, 0));
    const own = mine.filter((m) => m.source === 'own_funds');
    const firstOwnYm = own.length ? ymOf(own[0].date) : null;
    const lastOwn = own.length ? own[own.length - 1] : null;

    const monthsFlags: Record<string, { amount: number; sent: boolean; inflow: number }> = {};
    for (const m of own) {
      const ym = ymOf(m.date);
      const prev = monthsFlags[ym] ?? { amount: 0, sent: false, inflow: 0 };
      monthsFlags[ym] = {
        ...prev,
        amount: round2(prev.amount + m.amount),
        sent: prev.sent || m.transactionId !== null,
      };
    }
    // перетоки из других КАП и перерасчёты закрывают САМЫЕ РАННИЕ незакрытые
    // месяцы — независимо от даты, когда сделано перераспределение
    let inflowPool = round2(
      mine
        .filter((m) => ['from_cap', 'recalc'].includes(m.source) && m.amount > 0)
        .reduce((s, m) => s + m.amount, 0),
    );
    if (inflowPool > 0) {
      const startYmFlags =
        (g.asset_purchase_date ? ymOf(String(g.asset_purchase_date)) : null) ?? firstOwnYm ?? currentYm;
      for (let ym = startYmFlags; ym <= currentYm && inflowPool > 0.005; ym = ymAdd(ym, 1)) {
        const flag = monthsFlags[ym] ?? { amount: 0, sent: false, inflow: 0 };
        if (flag.amount >= monthly - 1) continue; // закрыт собственным взносом
        const need = round2(monthly - flag.amount);
        const take = Math.min(need, inflowPool);
        monthsFlags[ym] = { ...flag, inflow: round2(flag.inflow + take) };
        inflowPool = round2(inflowPool - take);
      }
    }

    let status: CapStatus;
    let behindAmount = 0;
    let waitUntil: string | null = null;
    const remaining = round2(target - contributed);

    if (g.spent_at) {
      status = 'spent';
    } else if (mine.length === 0) {
      status = 'not_started';
    } else if (remaining < 1) {
      // копеечная пыль от округления месячного взноса (N×взнос ≠ цель) прощается:
      // цель считается собранной, если не хватает меньше рубля
      waitUntil = lastOwn ? monthEnd(ymOf(lastOwn.date)) : null;
      status = waitUntil && today <= waitUntil ? 'waiting' : 'ready';
    } else if (firstOwnYm) {
      const monthsDue = Math.min(
        monthsBetweenInclusive(firstOwnYm, currentYm),
        Number(g.term_months),
      );
      const due = round2(monthsDue * monthly);
      behindAmount = round2(due - contributed);
      status = behindAmount > 0.01 ? 'behind' : 'in_progress';
      if (behindAmount <= 0.01) behindAmount = 0;
    } else {
      // только перетоки/корректировки, своих взносов нет
      status = 'in_progress';
    }

    return {
      id,
      name: g.name,
      target,
      monthly,
      termMonths: Number(g.term_months),
      contributed,
      remaining: Math.max(remaining, 0),
      status,
      behindAmount,
      waitUntil,
      monthsFlags,
      spentAt: g.spent_at,
      assetId: g.asset_id ? Number(g.asset_id) : null,
      assetCategoryName: g.asset_category_name,
      firstOwnYm,
      startDate: g.asset_purchase_date ?? null,
    };
  });

  // Платёж по флажкам: все own_funds без транзакции, любые месяцы (кроме потраченных целей)
  const pendingPayment = goals
    .filter((g) => g.status !== 'spent')
    .map((g) => {
      let amount = 0;
      let monthsCount = 0;
      for (const flag of Object.values(g.monthsFlags)) {
        if (!flag.sent && flag.amount > 0.005) {
          amount += flag.amount;
          monthsCount++;
        }
      }
      if (amount < 0.005) return null;
      return { goalId: g.id, name: g.name, amount: round2(amount), monthsCount };
    })
    .filter(Boolean) as CapOverview['pendingPayment'];
  const pendingTotal = round2(pendingPayment.reduce((s, p) => s + p.amount, 0));

  const ledgerTotal = round2(movements.reduce((s, m) => s + m.amount, 0));

  const balRes = await db.execute(sql`
    SELECT COALESCE(sum(balance), 0) AS s FROM v_account_balances WHERE type = 'savings_cap'
  `);
  const capAccountsBalance = toNum((balRes.rows as any[])[0]?.s);

  // размещения вводятся вручную на странице КАП (settings), приоритет за ручным
  const allocationsNet = round2(await getSetting<number>('cap_allocations', 0));

  const reconciliationDiff = round2(ledgerTotal - (capAccountsBalance + allocationsNet));

  return {
    goals,
    pendingPayment,
    pendingTotal,
    ledgerTotal,
    capAccountsBalance,
    allocationsNet,
    reconciliationDiff,
  };
}
