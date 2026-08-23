import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { RU_MONTHS, RU_MONTHS_DAT, monthEnd, monthStart, todayISO, ymOf } from '@/lib/dates';
import { round2, toNum } from '@/lib/money';

const label = (ym: string) => RU_MONTHS[Number(ym.slice(5, 7)) - 1].slice(0, 3).toLowerCase();

/** Границы: последние n месяцев, заканчивая ym (включительно). */
function monthsBack(ym: string, n: number): string {
  const [y, m] = [Number(ym.slice(0, 4)), Number(ym.slice(5, 7))];
  const d = new Date(y, m - n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ------------------------------------------------------------ вещи

export type ThingsWidgetData = {
  perDay: number; // стоимость владения всеми активными вещами в день
  activeCount: number;
  top: { name: string; monthly: number }[];
  releases: { label: string; monthly: number }[]; // когда освободятся начисления
  capexShare: { label: string; pct: number }[]; // доля покупок в фактических, 12 мес
};

export async function getThingsWidget(ym: string): Promise<ThingsWidgetData> {
  const from12 = monthsBack(ym, 11);
  const [assetsRes, relRes, capexRes] = await Promise.all([
    db.execute(sql`
      SELECT a.name, (a.initial_price + COALESCE(adj.s, 0)) / a.term_months AS monthly
      FROM assets a
      LEFT JOIN LATERAL (SELECT sum(amount) AS s FROM asset_adjustments WHERE asset_id = a.id) adj ON true
      WHERE a.disposed_at IS NULL
        AND EXISTS (SELECT 1 FROM amortization_accruals aa
                    WHERE aa.asset_id = a.id AND aa.accrual_date > ${monthEnd(ym)})
      ORDER BY 2 DESC
    `),
    db.execute(sql`
      SELECT to_char(last_d, 'YYYY-MM') AS ym, sum(monthly) AS s FROM (
        SELECT a.id, max(aa.accrual_date) AS last_d,
               (a.initial_price + COALESCE(adj.s, 0)) / a.term_months AS monthly
        FROM assets a
        JOIN amortization_accruals aa ON aa.asset_id = a.id
        LEFT JOIN LATERAL (SELECT sum(amount) AS s FROM asset_adjustments WHERE asset_id = a.id) adj ON true
        WHERE a.disposed_at IS NULL
        GROUP BY a.id, adj.s
      ) x
      WHERE last_d >= ${monthStart(ym)} AND last_d < ${monthStart(ym)}::date + interval '9 months'
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS ym,
             sum(amount) FILTER (WHERE src = 'purchase') AS purch,
             sum(amount) AS total
      FROM v_expenses_actual
      WHERE date >= ${from12} AND date <= ${monthEnd(ym)}
      GROUP BY 1 ORDER BY 1
    `),
  ]);

  const assets = (assetsRes.rows as any[]).map((r) => ({ name: r.name as string, monthly: toNum(r.monthly) }));
  const monthlySum = assets.reduce((s, a) => s + a.monthly, 0);
  return {
    perDay: round2((monthlySum * 12) / 365),
    activeCount: assets.length,
    top: assets.slice(0, 5).map((a) => ({ name: a.name, monthly: round2(a.monthly) })),
    releases: (relRes.rows as any[]).map((r) => ({ label: label(String(r.ym)), monthly: round2(toNum(r.s)) })),
    capexShare: (capexRes.rows as any[]).map((r) => ({
      label: label(String(r.ym)),
      pct: toNum(r.total) > 0 ? Math.round((toNum(r.purch) / toNum(r.total)) * 100) : 0,
    })),
  };
}

// ------------------------------------------------------------ ритмы

export type RhythmWidgetData = {
  heat: { date: string; amount: number }[]; // последние ~12 месяцев
  weekday: { label: string; avg: number }[];
  regular: { name: string; avg: number; months: number }[];
};

export async function getRhythmWidget(ym: string): Promise<RhythmWidgetData> {
  const from12 = monthsBack(ym, 11);
  const [heatRes, dwRes, regRes] = await Promise.all([
    db.execute(sql`
      SELECT date, sum(amount) AS s FROM v_expenses_actual
      WHERE date >= ${from12} AND date <= ${monthEnd(ym)}
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT EXTRACT(ISODOW FROM date)::int AS dw, sum(amount) AS s, count(DISTINCT date) AS days
      FROM v_expenses_actual
      WHERE date >= ${monthsBack(ym, 5)} AND date <= ${monthEnd(ym)} AND src = 'expense'
      GROUP BY 1 ORDER BY 1
    `),
    db.execute(sql`
      SELECT c.name, to_char(date_trunc('month', v.date), 'YYYY-MM') AS ym, sum(v.amount) AS s
      FROM v_expenses_actual v JOIN categories c ON c.id = v.category_id
      WHERE v.src = 'expense' AND v.date >= ${monthsBack(ym, 5)} AND v.date <= ${monthEnd(ym)}
      GROUP BY 1, 2
    `),
  ]);

  const names = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
  const weekday = (dwRes.rows as any[]).map((r) => ({
    label: names[Number(r.dw) - 1],
    avg: round2(toNum(r.s) / Math.max(1, Number(r.days))),
  }));

  // регулярные: категория встречается в ≥4 из 6 месяцев и суммы стабильны
  const byCat = new Map<string, number[]>();
  for (const r of regRes.rows as any[]) {
    const arr = byCat.get(r.name) ?? [];
    arr.push(toNum(r.s));
    byCat.set(r.name, arr);
  }
  const regular = [...byCat.entries()]
    .map(([name, sums]) => {
      const avg = sums.reduce((s, v) => s + v, 0) / sums.length;
      const cv = Math.sqrt(sums.reduce((s, v) => s + (v - avg) ** 2, 0) / sums.length) / (avg || 1);
      return { name, avg: round2(avg), months: sums.length, cv };
    })
    .filter((x) => x.months >= 4 && x.cv < 0.45 && x.avg >= 300)
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 6)
    .map(({ name, avg, months }) => ({ name, avg, months }));

  return {
    heat: (heatRes.rows as any[]).map((r) => ({ date: String(r.date), amount: round2(toNum(r.s)) })),
    weekday,
    regular,
  };
}

// ------------------------------------------------------------ инфляция

export type InflationWidgetData = {
  series: { label: string; Продукты: number | null; Кафе: number | null }[];
  groceryChange: number | null; // % первый→последний
  cafeChange: number | null;
};

export async function getInflationWidget(ym: string): Promise<InflationWidgetData> {
  const res = await db.execute(sql`
    SELECT to_char(date_trunc('month', v.date), 'YYYY-MM') AS ym,
      avg(v.amount) FILTER (WHERE c.name ILIKE '%продукт%') AS grocery,
      avg(v.amount) FILTER (WHERE c.name ILIKE '%кафе%') AS cafe
    FROM v_expenses_actual v JOIN categories c ON c.id = v.category_id
    WHERE v.src = 'expense' AND v.date >= ${monthsBack(ym, 11)} AND v.date <= ${monthEnd(ym)}
      AND v.amount > 0
    GROUP BY 1 ORDER BY 1
  `);
  const rows = (res.rows as any[]).map((r) => ({
    label: label(String(r.ym)),
    Продукты: r.grocery === null ? null : round2(toNum(r.grocery)),
    Кафе: r.cafe === null ? null : round2(toNum(r.cafe)),
  }));
  const change = (key: 'Продукты' | 'Кафе') => {
    const vals = rows.map((r) => r[key]).filter((v): v is number => v !== null && v > 0);
    if (vals.length < 3) return null;
    return Math.round(((vals[vals.length - 1] - vals[0]) / vals[0]) * 100);
  };
  return { series: rows, groceryChange: change('Продукты'), cafeChange: change('Кафе') };
}

// ------------------------------------------------------------ прогнозы

export type ForecastWidgetData = {
  avgSpend3: number;
  avgIncome3: number;
  yearSpendForecast: number | null;
  yearIncomeForecast: number | null;
  spentYtd: number;
  freeMonthly: number | null; // доход − расход − планы КАП/КС
  planCap: number;
  planKs: number;
  runwayMonths: number | null;
  liquid: number;
};

export async function getForecastWidget(ym: string): Promise<ForecastWidgetData> {
  const y = ym.slice(0, 4);
  const [avgRes, ytdRes, planRes, liquidRes] = await Promise.all([
    db.execute(sql`
      SELECT
        (SELECT COALESCE(avg(s), 0) FROM (
          SELECT sum(amount) AS s FROM v_expenses_actual
          WHERE date >= ${monthsBack(ym, 3)} AND date < ${monthStart(ym)}
          GROUP BY date_trunc('month', date)) x) AS spend,
        (SELECT COALESCE(avg(s), 0) FROM (
          SELECT sum(amount) AS s FROM transactions
          WHERE kind = 'income' AND date >= ${monthsBack(ym, 3)} AND date < ${monthStart(ym)}
          GROUP BY date_trunc('month', date)) x) AS income
    `),
    db.execute(sql`
      SELECT
        COALESCE((SELECT sum(amount) FROM v_expenses_actual
                  WHERE date >= ${`${y}-01-01`} AND date <= ${monthEnd(ym)}), 0) AS spent,
        COALESCE((SELECT sum(amount) FROM transactions
                  WHERE kind = 'income' AND date >= ${`${y}-01-01`} AND date <= ${monthEnd(ym)}), 0) AS earned
    `),
    db.execute(sql`
      SELECT
        COALESCE((SELECT sum(monthly_contribution) FROM cap_goals WHERE spent_at IS NULL), 0) AS cap,
        COALESCE((SELECT sum(monthly_plan) FROM fund_categories WHERE active_to IS NULL), 0) AS ks
    `),
    db.execute(sql`
      SELECT COALESCE(sum(balance), 0) AS s FROM v_account_balances
      WHERE currency = 'RUB' AND type IN ('checking','savings_cap','savings_ks','cash','deposit')
    `),
  ]);
  const avg = (avgRes.rows as any[])[0];
  const ytd = (ytdRes.rows as any[])[0];
  const plan = (planRes.rows as any[])[0];
  const avgSpend3 = round2(toNum(avg?.spend));
  const avgIncome3 = round2(toNum(avg?.income));
  const m = Number(ym.slice(5, 7));
  const monthsLeft = 12 - m;
  const liquid = round2(toNum((liquidRes.rows as any[])[0]?.s));
  return {
    avgSpend3,
    avgIncome3,
    spentYtd: round2(toNum(ytd?.spent)),
    yearSpendForecast: avgSpend3 > 0 ? round2(toNum(ytd?.spent) + avgSpend3 * monthsLeft) : null,
    yearIncomeForecast: avgIncome3 > 0 ? round2(toNum(ytd?.earned) + avgIncome3 * monthsLeft) : null,
    planCap: round2(toNum(plan?.cap)),
    planKs: round2(toNum(plan?.ks)),
    freeMonthly:
      avgIncome3 > 0
        ? round2(avgIncome3 - avgSpend3 - toNum(plan?.cap) - toNum(plan?.ks))
        : null,
    runwayMonths: avgSpend3 > 0 && liquid > 0 ? round2(liquid / avgSpend3) : null,
    liquid,
  };
}

// ------------------------------------------------------------ фонды

export type FundsWidgetData = {
  ksBurn: { name: string; balance: number; perMonth: number; monthsLeft: number }[];
  ksHealthy: number;
  capOnTrack: number;
  capBehind: number;
  capBehindSum: number;
  capDoneBy: string | null; // «март 2027»
};

export async function getFundsWidget(ym: string): Promise<FundsWidgetData> {
  const [ksRes, capRes] = await Promise.all([
    db.execute(sql`
      SELECT fc.name,
        fc.opening_balance + COALESCE((SELECT sum(amount) FROM fund_movements WHERE fund_category_id = fc.id), 0) AS balance,
        COALESCE((SELECT avg(x.s) FROM (
          SELECT sum(-fm.amount) AS s FROM fund_movements fm
          WHERE fm.fund_category_id = fc.id AND fm.kind = 'reimbursement'
            AND fm.date >= ${monthsBack(ym, 3)} AND fm.date <= ${monthEnd(ym)}
          GROUP BY date_trunc('month', fm.date)) x), 0) AS per_month
      FROM fund_categories fc
      WHERE fc.active_to IS NULL
    `),
    db.execute(sql`
      SELECT g.id, g.monthly_contribution AS monthly, g.target_amount AS target,
        COALESCE((SELECT sum(amount) FROM cap_movements WHERE cap_goal_id = g.id), 0) AS contributed,
        (SELECT min(date) FROM cap_movements WHERE cap_goal_id = g.id AND source = 'own_funds') AS first_own
      FROM cap_goals g WHERE g.spent_at IS NULL
    `),
  ]);

  const burn = (ksRes.rows as any[])
    .map((r) => ({
      name: r.name as string,
      balance: round2(toNum(r.balance)),
      perMonth: round2(toNum(r.per_month)),
    }))
    .filter((x) => x.perMonth > 0 && x.balance > 0)
    .map((x) => ({ ...x, monthsLeft: round2(x.balance / x.perMonth) }))
    .sort((a, b) => a.monthsLeft - b.monthsLeft);

  const nowYm = ym;
  let onTrack = 0;
  let behind = 0;
  let behindSum = 0;
  let maxMonthsToFinish = 0;
  for (const r of capRes.rows as any[]) {
    const monthly = toNum(r.monthly);
    const target = toNum(r.target);
    const contributed = toNum(r.contributed);
    const remaining = Math.max(0, target - contributed);
    if (monthly > 0) maxMonthsToFinish = Math.max(maxMonthsToFinish, Math.ceil(remaining / monthly));
    if (r.first_own) {
      const fy = Number(String(r.first_own).slice(0, 4));
      const fm = Number(String(r.first_own).slice(5, 7));
      const monthsDue =
        (Number(nowYm.slice(0, 4)) - fy) * 12 + (Number(nowYm.slice(5, 7)) - fm) + 1;
      const due = Math.min(monthsDue * monthly, target);
      if (contributed + 0.01 < due) {
        behind++;
        behindSum += due - contributed;
      } else onTrack++;
    } else if (contributed > 0) onTrack++;
  }
  let capDoneBy: string | null = null;
  if (maxMonthsToFinish > 0) {
    const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1 + maxMonthsToFinish, 1);
    capDoneBy = `${RU_MONTHS_DAT[d.getMonth()]} ${d.getFullYear()}`;
  }

  return {
    ksBurn: burn.slice(0, 4),
    ksHealthy: (ksRes.rows as any[]).length - burn.length,
    capOnTrack: onTrack,
    capBehind: behind,
    capBehindSum: round2(behindSum),
    capDoneBy,
  };
}

// ------------------------------------------------------------ сравнения

export type CompareWidgetData = {
  yoy: { name: string; current: number; lastYear: number }[] | null;
  lastYearYm: string;
  bigShare: number | null; // % суммы месяца от топ-10% операций
  opsCount: number;
  medianOp: number | null;
};

export async function getCompareWidget(ym: string): Promise<CompareWidgetData> {
  const lastYearYm = `${Number(ym.slice(0, 4)) - 1}${ym.slice(4)}`;
  const [yoyRes, opsRes] = await Promise.all([
    db.execute(sql`
      SELECT cg.name, to_char(date_trunc('month', v.date), 'YYYY-MM') AS ym, sum(v.amount) AS s
      FROM v_expenses_actual v JOIN category_groups cg ON cg.id = v.group_id
      WHERE date_trunc('month', v.date) IN (${monthStart(ym)}::date, ${monthStart(lastYearYm)}::date)
      GROUP BY 1, 2
    `),
    db.execute(sql`
      SELECT amount FROM v_expenses_actual
      WHERE date BETWEEN ${monthStart(ym)} AND ${monthEnd(ym)} AND amount > 0
      ORDER BY amount DESC
    `),
  ]);

  const map = new Map<string, { current: number; lastYear: number }>();
  for (const r of yoyRes.rows as any[]) {
    const e = map.get(r.name) ?? { current: 0, lastYear: 0 };
    if (String(r.ym) === ym) e.current = toNum(r.s);
    else e.lastYear = toNum(r.s);
    map.set(r.name, e);
  }
  const hasLastYear = [...map.values()].some((v) => v.lastYear > 0);
  const yoy = hasLastYear
    ? [...map.entries()]
        .map(([name, v]) => ({ name, current: round2(v.current), lastYear: round2(v.lastYear) }))
        .filter((x) => x.current > 0 || x.lastYear > 0)
        .sort((a, b) => b.current - a.current)
        .slice(0, 7)
    : null;

  const ops = (opsRes.rows as any[]).map((r) => toNum(r.amount));
  const total = ops.reduce((s, v) => s + v, 0);
  const topN = Math.max(1, Math.floor(ops.length * 0.1));
  return {
    yoy,
    lastYearYm,
    bigShare: ops.length >= 10 && total > 0
      ? Math.round((ops.slice(0, topN).reduce((s, v) => s + v, 0) / total) * 100)
      : null,
    opsCount: ops.length,
    medianOp: ops.length ? round2(ops[Math.floor(ops.length / 2)]) : null,
  };
}

// ------------------------------------------------------------ гигиена

export type HygieneWidgetData = {
  filled: number;
  checkable: number;
  maxZeroStreak: number;
  staleAccounts: { name: string; days: number }[]; // давно не сверялись
  neverChecked: number;
};

export async function getHygieneWidget(ym: string): Promise<HygieneWidgetData> {
  const today = todayISO();
  const isCurrent = ym === ymOf(today);
  const checkable = isCurrent ? Number(today.slice(8, 10)) : new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  const [filledRes, daysRes, snapsRes] = await Promise.all([
    db.execute(sql`SELECT count(*) AS c FROM filled_days WHERE date BETWEEN ${monthStart(ym)} AND ${monthEnd(ym)}`),
    db.execute(sql`
      SELECT EXTRACT(DAY FROM date)::int AS d FROM v_expenses_actual
      WHERE date BETWEEN ${monthStart(ym)} AND ${monthEnd(ym)} GROUP BY 1
    `),
    db.execute(sql`
      SELECT name, last_snapshot_date FROM v_account_balances
      WHERE include_in_total AND type IN ('checking','credit_card','savings_cap','savings_ks','cash')
    `),
  ]);
  const withSpend = new Set((daysRes.rows as any[]).map((r) => Number(r.d)));
  let maxZeroStreak = 0;
  let cur = 0;
  for (let d = 1; d <= checkable; d++) {
    if (!withSpend.has(d)) {
      cur++;
      maxZeroStreak = Math.max(maxZeroStreak, cur);
    } else cur = 0;
  }
  const stale: { name: string; days: number }[] = [];
  let neverChecked = 0;
  for (const r of snapsRes.rows as any[]) {
    if (!r.last_snapshot_date) {
      neverChecked++;
      continue;
    }
    const days = Math.floor(
      (new Date(today).getTime() - new Date(String(r.last_snapshot_date)).getTime()) / 86400000,
    );
    if (days >= 30) stale.push({ name: r.name, days });
  }
  stale.sort((a, b) => b.days - a.days);
  return {
    filled: Number((filledRes.rows as any[])[0]?.c ?? 0),
    checkable,
    maxZeroStreak,
    staleAccounts: stale.slice(0, 3),
    neverChecked,
  };
}

// ------------------------------------------------------------ тренд 12 месяцев

export type TrendPoint = { label: string; actual: number; accrued: number; income: number };

export async function getTrendSeries(ym: string): Promise<TrendPoint[]> {
  const from12 = monthsBack(ym, 11);
  const res = await db.execute(sql`
    SELECT to_char(mm, 'YYYY-MM') AS ym,
      COALESCE((SELECT sum(amount) FROM v_expenses_actual v
                WHERE v.date >= mm AND v.date < mm + interval '1 month'), 0) AS actual,
      COALESCE((SELECT sum(amount) FROM v_expenses_accrued v
                WHERE v.date >= mm AND v.date < mm + interval '1 month'), 0) AS accrued,
      COALESCE((SELECT sum(amount) FROM transactions t
                WHERE t.kind = 'income' AND t.date >= mm AND t.date < mm + interval '1 month'), 0) AS income
    FROM generate_series(${from12}::date, ${monthStart(ym)}::date, interval '1 month') mm
    ORDER BY 1
  `);
  return (res.rows as any[]).map((r) => ({
    label: label(String(r.ym)),
    actual: round2(toNum(r.actual)),
    accrued: round2(toNum(r.accrued)),
    income: round2(toNum(r.income)),
  }));
}

// ------------------------------------------------------------ заполненность

export type FillDay = { date: string; status: 0 | 1 | 2 }; // 2 отмечен · 1 операции без отметки · 0 пусто
export type FillYear = { year: number; days: FillDay[]; filled: number; passed: number };
export type FillWidgetData = {
  years: FillYear[]; // от старых к новым, от первого дня данных до сегодня
  gaps: { from: string; to: string; days: number }[]; // самые длинные серии без отметки
};

export async function getFillWidget(): Promise<FillWidgetData> {
  const today = todayISO();
  const [filledRes, opsRes, firstRes] = await Promise.all([
    db.execute(sql`SELECT date FROM filled_days ORDER BY 1`),
    db.execute(sql`SELECT DISTINCT date FROM v_expenses_actual ORDER BY 1`),
    db.execute(sql`
      SELECT LEAST(
        COALESCE((SELECT min(date) FROM filled_days), ${today}::date),
        COALESCE((SELECT min(date) FROM transactions), ${today}::date)
      ) AS d
    `),
  ]);
  const filled = new Set((filledRes.rows as any[]).map((r) => String(r.date)));
  const ops = new Set((opsRes.rows as any[]).map((r) => String(r.date)));
  const start = String((firstRes.rows as any[])[0]?.d ?? today);

  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const byYear = new Map<number, FillDay[]>();
  const cursor = new Date(`${start.slice(0, 4)}-01-01T00:00:00`);
  // идём от начала первого года с данными до сегодня; дни до первой записи не судим
  for (; iso(cursor) <= today; cursor.setDate(cursor.getDate() + 1)) {
    const date = iso(cursor);
    if (date < start) continue;
    const status: 0 | 1 | 2 = filled.has(date) ? 2 : ops.has(date) ? 1 : 0;
    const y = cursor.getFullYear();
    byYear.set(y, [...(byYear.get(y) ?? []), { date, status }]);
  }

  const years: FillYear[] = [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, days]) => ({
      year,
      days,
      filled: days.filter((d) => d.status === 2).length,
      passed: days.length,
    }));

  // дырки: подряд идущие дни без отметки (операции без галочки тоже дырка)
  const all = years.flatMap((y) => y.days);
  const gaps: { from: string; to: string; days: number }[] = [];
  let run: FillDay[] = [];
  const flush = () => {
    if (run.length >= 3) gaps.push({ from: run[0].date, to: run[run.length - 1].date, days: run.length });
    run = [];
  };
  for (const d of all) {
    if (d.status === 2) flush();
    else run.push(d);
  }
  flush();
  gaps.sort((a, b) => b.days - a.days);

  return { years, gaps: gaps.slice(0, 30) };
}

// ------------------------------------------------------------ сверка КАП

export type CapCheckWidgetData = {
  /** месяцы, где сумма переводов на счёт КАП не сошлась со взносами-флажками */
  mismatches: { ym: string; label: string; transfers: number; contribs: number; diff: number }[];
  monthsChecked: number;
  totalTransfers: number;
  totalContribs: number;
  totalDiff: number;
};

export async function getCapCheckWidget(): Promise<CapCheckWidgetData> {
  const [trRes, cRes] = await Promise.all([
    db.execute(sql`
      SELECT to_char(date_trunc('month', t.date), 'YYYY-MM') AS ym, sum(t.amount) AS s
      FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
      WHERE t.kind = 'transfer' AND ca.type = 'savings_cap'
      GROUP BY 1
    `),
    db.execute(sql`
      SELECT to_char(date_trunc('month', m.date), 'YYYY-MM') AS ym, sum(m.amount) AS s
      FROM cap_movements m WHERE m.source = 'own_funds'
      GROUP BY 1
    `),
  ]);
  const transfers = new Map((trRes.rows as any[]).map((r) => [String(r.ym), toNum(r.s)]));
  const contribs = new Map((cRes.rows as any[]).map((r) => [String(r.ym), toNum(r.s)]));
  const yms = [...new Set([...transfers.keys(), ...contribs.keys()])].sort();

  const monthLabel = (ym: string) =>
    `${RU_MONTHS[Number(ym.slice(5, 7)) - 1].toLowerCase()} ${ym.slice(0, 4)}`;
  const mismatches = yms
    .map((ym) => {
      const t = round2(transfers.get(ym) ?? 0);
      const c = round2(contribs.get(ym) ?? 0);
      return { ym, label: monthLabel(ym), transfers: t, contribs: c, diff: round2(t - c) };
    })
    .filter((m) => Math.abs(m.diff) > 0.005)
    .reverse();

  const totalTransfers = round2([...transfers.values()].reduce((s, v) => s + v, 0));
  const totalContribs = round2([...contribs.values()].reduce((s, v) => s + v, 0));
  return {
    mismatches,
    monthsChecked: yms.length,
    totalTransfers,
    totalContribs,
    totalDiff: round2(totalTransfers - totalContribs),
  };
}

// ------------------------------------------------------ сверка амортизации

export type AmortCheckWidgetData = {
  /** активные вещи, у которых график начислений бьётся с ценой или сроком */
  broken: { name: string; price: number; scheduled: number; diff: number; countDiff: number }[];
  okCount: number;
  totalAssets: number;
};

export async function getAmortCheckWidget(): Promise<AmortCheckWidgetData> {
  const res = await db.execute(sql`
    SELECT a.name,
           a.initial_price + COALESCE(adj.s, 0) AS price,
           COALESCE(acc.s, 0) AS scheduled,
           COALESCE(acc.cnt, 0) AS cnt,
           a.term_months
    FROM assets a
    LEFT JOIN LATERAL (SELECT sum(amount) AS s FROM asset_adjustments WHERE asset_id = a.id) adj ON true
    LEFT JOIN LATERAL (
      SELECT sum(amount) AS s, count(*) AS cnt FROM amortization_accruals WHERE asset_id = a.id
    ) acc ON true
    WHERE a.disposed_at IS NULL
  `);
  const rows = (res.rows as any[]).map((r) => ({
    name: String(r.name),
    price: round2(toNum(r.price)),
    scheduled: round2(toNum(r.scheduled)),
    cnt: Number(r.cnt),
    term: Number(r.term_months),
  }));
  const broken = rows
    .filter((r) => Math.abs(r.scheduled - r.price) > 0.01 || r.cnt !== r.term)
    .map((r) => ({
      name: r.name,
      price: r.price,
      scheduled: r.scheduled,
      diff: round2(r.scheduled - r.price),
      countDiff: r.cnt - r.term,
    }))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 20);
  return { broken, okCount: rows.length - broken.length, totalAssets: rows.length };
}
