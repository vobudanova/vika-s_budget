import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { RU_MONTHS, RU_MONTHS_GEN, monthEnd, monthStart, todayISO, ymOf } from '@/lib/dates';
import { fmtMoney, round2, toNum } from '@/lib/money';

export type Insight = {
  kind: 'finding' | 'advice' | 'record' | 'warning';
  title: string;
  text: string;
};

export type GroupStat = {
  name: string;
  current: number;
  prev: number;
  avg: number; // среднее по предыдущим месяцам с данными (до 6)
  share: number; // доля в расходах месяца
};

export type MonthPoint = {
  ym: string;
  label: string; // «янв», «фев»…
  actual: number;
  accrued: number;
  income: number;
  saved: number; // переводы на сберегательные счета + сбережения
};

export type DayPoint = { day: number; amount: number };

export type Analytics = {
  ym: string;
  monthTitle: string;
  daysInMonth: number;
  daysPassed: number; // для текущего месяца — прошедшие дни, иначе все

  actualMonth: number;
  accruedMonth: number;
  actualPrev: number;
  incomeMonth: number;
  savedMonth: number;
  avgPerDay: number;
  forecastMonth: number | null; // прогноз до конца месяца (только текущий)

  daily: DayPoint[];
  groups: GroupStat[];
  months: MonthPoint[]; // последние 12 месяцев включая текущий

  topExpenses: { date: string; label: string; sub: string | null; amount: number }[];
  maxDay: { day: number; amount: number } | null;

  insights: Insight[];
};

const pct = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v)}%`;
const money0 = (v: number) => fmtMoney(Math.round(v));

export async function getAnalytics(ym: string): Promise<Analytics> {
  const today = todayISO();
  const currentYm = ymOf(today);
  const from = monthStart(ym);
  const to = monthEnd(ym);
  const [y, m] = [Number(ym.slice(0, 4)), Number(ym.slice(5, 7))];
  const daysInMonth = new Date(y, m, 0).getDate();
  const isCurrent = ym === currentYm;
  const daysPassed = isCurrent ? Number(today.slice(8, 10)) : daysInMonth;

  // последние 12 месяцев (включая ym)
  const start12 = new Date(y, m - 12, 1);
  const from12 = `${start12.getFullYear()}-${String(start12.getMonth() + 1).padStart(2, '0')}-01`;

  const [dailyRes, groupsRes, monthsRes, topRes, weekdayRes, extrasRes, fundRes, capRes, filledRes] =
    await Promise.all([
      db.execute(sql`
        SELECT EXTRACT(DAY FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_actual WHERE date BETWEEN ${from} AND ${to}
        GROUP BY 1 ORDER BY 1
      `),
      db.execute(sql`
        SELECT cg.name, to_char(v.date, 'YYYY-MM') AS ym, sum(v.amount) AS s
        FROM v_expenses_actual v JOIN category_groups cg ON cg.id = v.group_id
        WHERE v.date >= ${from12} AND v.date <= ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT to_char(mm, 'YYYY-MM') AS ym,
          COALESCE((SELECT sum(amount) FROM v_expenses_actual v
                    WHERE v.date >= mm AND v.date < mm + interval '1 month'), 0) AS actual,
          COALESCE((SELECT sum(amount) FROM v_expenses_accrued v
                    WHERE v.date >= mm AND v.date < mm + interval '1 month'), 0) AS accrued,
          COALESCE((SELECT sum(amount) FROM transactions t
                    WHERE t.kind = 'income' AND t.date >= mm AND t.date < mm + interval '1 month'), 0) AS income,
          COALESCE((SELECT sum(t.amount) FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
                    WHERE t.kind IN ('transfer','saving')
                      AND ca.type IN ('savings_cap','savings_ks','deposit','metals','brokerage')
                      AND t.date >= mm AND t.date < mm + interval '1 month'), 0) AS saved
        FROM generate_series(${from12}::date, ${from}::date, interval '1 month') mm
        ORDER BY 1
      `),
      db.execute(sql`
        SELECT v.date, c.name AS label, v.note AS sub, v.amount AS s
        FROM v_expenses_actual v JOIN categories c ON c.id = v.category_id
        WHERE v.date BETWEEN ${from} AND ${to}
        ORDER BY v.amount DESC LIMIT 5
      `),
      db.execute(sql`
        SELECT EXTRACT(ISODOW FROM date)::int AS dw, sum(amount) AS s, count(DISTINCT date) AS days
        FROM v_expenses_actual
        WHERE date >= ${from}::date - interval '2 months' AND date <= ${to}
        GROUP BY 1
      `),
      db.execute(sql`
        SELECT
          (SELECT COALESCE(sum(amount), 0) FROM v_expenses_actual v
           WHERE v.src = 'expense' AND v.date BETWEEN ${from} AND ${to}
             AND v.category_id IN (SELECT id FROM categories WHERE name ILIKE '%кафе%')) AS cafe,
          (SELECT COALESCE(sum(amount), 0) FROM v_expenses_actual v
           WHERE v.src = 'expense' AND v.date BETWEEN ${from} AND ${to}
             AND v.category_id IN (SELECT id FROM categories WHERE name ILIKE '%продукт%')) AS grocery,
          (SELECT COALESCE(sum(amount), 0) FROM v_expenses_actual v
           WHERE v.src = 'purchase' AND v.date BETWEEN ${from} AND ${to}) AS purchases,
          (SELECT COALESCE(sum(amount), 0) FROM v_expenses_accrued v
           WHERE v.src = 'amortization' AND v.date BETWEEN ${from} AND ${to}) AS amort
      `),
      db.execute(sql`
        SELECT fc.name,
          COALESCE(sum(-fm.amount) FILTER (WHERE fm.kind = 'reimbursement'
            AND fm.date >= ${`${y}-01-01`} AND fm.date <= ${to}), 0) AS spent_ytd,
          fc.monthly_plan * ${m} AS plan_ytd
        FROM fund_categories fc
        LEFT JOIN fund_movements fm ON fm.fund_category_id = fc.id
        GROUP BY fc.id
        HAVING COALESCE(sum(-fm.amount) FILTER (WHERE fm.kind = 'reimbursement'
          AND fm.date >= ${`${y}-01-01`} AND fm.date <= ${to}), 0) > fc.monthly_plan * ${m}
          AND fc.monthly_plan > 0
        ORDER BY 2 DESC LIMIT 3
      `),
      db.execute(sql`
        SELECT count(*) AS behind FROM (
          SELECT g.id FROM cap_goals g WHERE g.spent_at IS NULL
        ) x
      `),
      db.execute(sql`
        SELECT count(*) AS c FROM filled_days WHERE date BETWEEN ${from} AND ${to}
      `),
    ]);

  // — дневная динамика —
  const daily: DayPoint[] = Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, amount: 0 }));
  for (const r of dailyRes.rows as any[]) daily[Number(r.d) - 1].amount = round2(toNum(r.s));
  const actualMonth = round2(daily.reduce((s, d) => s + d.amount, 0));
  const maxDay = daily.reduce<DayPoint | null>(
    (best, d) => (d.amount > (best?.amount ?? 0) ? d : best),
    null,
  );

  // — 12 месяцев —
  const months: MonthPoint[] = (monthsRes.rows as any[]).map((r) => ({
    ym: r.ym,
    label: RU_MONTHS[Number(String(r.ym).slice(5, 7)) - 1].slice(0, 3).toLowerCase(),
    actual: round2(toNum(r.actual)),
    accrued: round2(toNum(r.accrued)),
    income: round2(toNum(r.income)),
    saved: round2(toNum(r.saved)),
  }));
  const cur = months.find((x) => x.ym === ym);
  const prevYm = months[months.length - 2]?.ym ?? null;
  const accruedMonth = cur?.accrued ?? 0;
  const incomeMonth = cur?.income ?? 0;
  const savedMonth = cur?.saved ?? 0;
  const actualPrev = months[months.length - 2]?.actual ?? 0;

  // — группы: текущий, прошлый, среднее —
  const byGroup = new Map<string, Map<string, number>>();
  for (const r of groupsRes.rows as any[]) {
    const g = byGroup.get(r.name) ?? new Map();
    g.set(r.ym, toNum(r.s));
    byGroup.set(r.name, g);
  }
  const groups: GroupStat[] = [...byGroup.entries()]
    .map(([name, byYm]) => {
      const current = byYm.get(ym) ?? 0;
      const prev = prevYm ? (byYm.get(prevYm) ?? 0) : 0;
      const past = [...byYm.entries()].filter(([k]) => k < ym).map(([, v]) => v);
      const avg = past.length ? past.reduce((s, v) => s + v, 0) / past.length : 0;
      return {
        name,
        current: round2(current),
        prev: round2(prev),
        avg: round2(avg),
        share: actualMonth > 0 ? current / actualMonth : 0,
      };
    })
    .filter((g) => g.current > 0 || g.prev > 0)
    .sort((a, b) => b.current - a.current);

  const avgPerDay = daysPassed > 0 ? round2(actualMonth / daysPassed) : 0;
  const forecastMonth =
    isCurrent && daysPassed >= 3 && actualMonth > 0 ? round2(avgPerDay * daysInMonth) : null;

  const topExpenses = (topRes.rows as any[]).map((r) => ({
    date: String(r.date),
    label: String(r.label),
    sub: (r.sub as string | null) ?? null,
    amount: round2(toNum(r.s)),
  }));

  // ------------------------------------------------------------- находки
  const insights: Insight[] = [];
  const extras = (extrasRes.rows as any[])[0] ?? {};
  const monthGen = RU_MONTHS_GEN[m - 1];
  const monthsWithData = months.filter((x) => x.actual > 0);

  // темп месяца против прошлого
  if (actualMonth > 0 && actualPrev > 0 && !isCurrent) {
    const diff = ((actualMonth - actualPrev) / actualPrev) * 100;
    if (Math.abs(diff) >= 12) {
      insights.push({
        kind: 'finding',
        title: diff > 0 ? `Расходы выросли на ${Math.round(diff)}%` : `Расходы упали на ${Math.round(-diff)}%`,
        text: `${money0(actualMonth)} против ${money0(actualPrev)} месяцем раньше — разница ${money0(Math.abs(actualMonth - actualPrev))}.`,
      });
    }
  }
  if (forecastMonth && actualPrev > 0) {
    const diff = ((forecastMonth - actualPrev) / actualPrev) * 100;
    insights.push({
      kind: Math.abs(diff) >= 15 ? 'warning' : 'finding',
      title: `Темп ${monthGen}: ~${money0(forecastMonth)} к концу месяца`,
      text: `Средний расход ${money0(avgPerDay)}/день за ${daysPassed} дн. Прошлый месяц закрылся на ${money0(actualPrev)} (${pct(diff)} к нему).`,
    });
  }

  // концентрация: топ-3 дня
  if (actualMonth > 0) {
    const top3 = [...daily].sort((a, b) => b.amount - a.amount).slice(0, 3);
    const top3sum = top3.reduce((s, d) => s + d.amount, 0);
    const share = (top3sum / actualMonth) * 100;
    if (share >= 45 && top3[0].amount > 0) {
      insights.push({
        kind: 'finding',
        title: `Три дня сделали ${Math.round(share)}% месяца`,
        text: `${top3
          .filter((d) => d.amount > 0)
          .map((d) => `${d.day} ${monthGen} — ${money0(d.amount)}`)
          .join(', ')}. Остальные дни заметно спокойнее.`,
      });
    }
  }

  // категория-рекордсмен и её отклонение от среднего
  const lead = groups[0];
  if (lead && lead.share >= 0.25 && lead.avg > 0) {
    const diff = ((lead.current - lead.avg) / lead.avg) * 100;
    insights.push({
      kind: 'finding',
      title: `«${lead.name}» — ${Math.round(lead.share * 100)}% всех трат`,
      text:
        Math.abs(diff) >= 15
          ? `${money0(lead.current)} за месяц — ${pct(diff)} к своему обычному уровню (${money0(lead.avg)}/мес).`
          : `${money0(lead.current)} за месяц — примерно на своём обычном уровне (${money0(lead.avg)}/мес).`,
    });
  }

  // быстрорастущая и быстро упавшая группы
  for (const g of groups) {
    if (g.prev >= 2000 && g.current >= g.prev * 1.6 && g !== lead) {
      insights.push({
        kind: 'finding',
        title: `«${g.name}» ×${(g.current / g.prev).toFixed(1)} к прошлому месяцу`,
        text: `${money0(g.prev)} → ${money0(g.current)}. Стоит глянуть раскладку на странице месяца.`,
      });
      break;
    }
  }
  for (const g of groups) {
    if (g.prev >= 5000 && g.current <= g.prev * 0.45) {
      insights.push({
        kind: 'finding',
        title: `«${g.name}» почти замерла`,
        text: `${money0(g.prev)} в прошлом месяце → ${money0(g.current)} сейчас (−${Math.round((1 - g.current / g.prev) * 100)}%).`,
      });
      break;
    }
  }

  // кафе против продуктов
  const cafe = toNum(extras.cafe);
  const grocery = toNum(extras.grocery);
  if (cafe + grocery >= 5000 && cafe > 0) {
    const share = Math.round((cafe / (cafe + grocery)) * 100);
    insights.push({
      kind: share >= 45 ? 'advice' : 'finding',
      title: `${share}% еды — кафе и доставка`,
      text:
        share >= 45
          ? `Кафе ${money0(cafe)} против продуктов ${money0(grocery)}. Если сместить хотя бы четверть в «Продукты», месяц станет легче примерно на ${money0(cafe * 0.15)}.`
          : `Кафе ${money0(cafe)}, продукты ${money0(grocery)} — здоровое соотношение.`,
    });
  }

  // покупки и амортизация
  const purchases = toNum(extras.purchases);
  const amort = toNum(extras.amort);
  if (purchases >= 3000) {
    insights.push({
      kind: 'finding',
      title: `Покупок на ${money0(purchases)}`,
      text: `В начисленном методе месяц несёт только ${money0(amort)} амортизации — остальное растянется на срок службы вещей. Фактический и начисленный итоги поэтому расходятся.`,
    });
  }

  // норма сбережений
  if (incomeMonth > 0) {
    const rate = ((incomeMonth - actualMonth) / incomeMonth) * 100;
    if (rate > 5) {
      insights.push({
        kind: 'advice',
        title: `Сохранено ${Math.round(rate)}% дохода`,
        text: `Доход ${money0(incomeMonth)}, фактические расходы ${money0(actualMonth)}. В таком темпе за год отложится порядка ${money0((incomeMonth - actualMonth) * 12)}.`,
      });
    } else if (rate < -5) {
      insights.push({
        kind: 'warning',
        title: `Расходы выше дохода на ${money0(actualMonth - incomeMonth)}`,
        text: `Доход ${money0(incomeMonth)} против расходов ${money0(actualMonth)}. Часть месяца оплачена накоплениями — это нормально, если так и задумано.`,
      });
    }
  }

  // день недели-лидер (за ~3 месяца)
  const dw = (weekdayRes.rows as any[])
    .map((r) => ({ dw: Number(r.dw), avg: toNum(r.s) / Math.max(1, Number(r.days)) }))
    .sort((a, b) => b.avg - a.avg);
  if (dw.length >= 5 && dw[0].avg > 0) {
    const names = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям'];
    const rest = dw.slice(1).reduce((s, x) => s + x.avg, 0) / (dw.length - 1);
    if (rest > 0 && dw[0].avg / rest >= 1.7) {
      insights.push({
        kind: 'finding',
        title: `По ${names[dw[0].dw - 1]} траты в ${(dw[0].avg / rest).toFixed(1)} раза выше`,
        text: `В среднем ${money0(dw[0].avg)} против ${money0(rest)} в остальные дни (за последние три месяца).`,
      });
    }
  }

  // перерасход статей КС
  const fundOver = fundRes.rows as any[];
  if (fundOver.length > 0) {
    const worst = fundOver[0];
    insights.push({
      kind: 'warning',
      title: `Статья КС «${worst.name}» опережает план`,
      text: `С начала года израсходовано ${money0(toNum(worst.spent_ytd))} при плане ${money0(toNum(worst.plan_ytd))}. ${
        fundOver.length > 1 ? `Ещё под давлением: ${fundOver.slice(1).map((f) => `«${f.name}»`).join(', ')}.` : ''
      }`,
    });
  }

  // незаполненные дни
  const filledCount = Number((filledRes.rows as any[])[0]?.c ?? 0);
  const checkableDays = isCurrent ? daysPassed : daysInMonth;
  if (checkableDays - filledCount >= 5 && filledCount > 0) {
    insights.push({
      kind: 'advice',
      title: `${checkableDays - filledCount} дн. без отметки «заполнен»`,
      text: `Из ${checkableDays} дней месяца отмечено ${filledCount}. Если траты за пропущенные дни не внесены, картина месяца занижена.`,
    });
  }

  // рекорды за 12 месяцев
  if (monthsWithData.length >= 3) {
    const max = monthsWithData.reduce((a, b) => (b.actual > a.actual ? b : a));
    const min = monthsWithData.reduce((a, b) => (b.actual < a.actual ? b : a));
    const avg = monthsWithData.reduce((s, x) => s + x.actual, 0) / monthsWithData.length;
    insights.push({
      kind: 'record',
      title: `Обычный месяц — около ${money0(avg)}`,
      text: `Самый дорогой из последних — ${max.label} (${money0(max.actual)}), самый лёгкий — ${min.label} (${money0(min.actual)}). Текущий ${
        actualMonth > avg ? 'выше' : 'ниже'
      } среднего на ${money0(Math.abs(actualMonth - avg))}.`,
    });
  }

  // самая крупная трата месяца
  if (topExpenses[0] && actualMonth > 0 && topExpenses[0].amount / actualMonth >= 0.15) {
    const t = topExpenses[0];
    insights.push({
      kind: 'record',
      title: `Крупнейшая трата — ${money0(t.amount)}`,
      text: `${t.label}${t.sub ? ` (${t.sub})` : ''}, ${Number(t.date.slice(8, 10))} ${monthGen} — ${Math.round((t.amount / actualMonth) * 100)}% всего месяца.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      kind: 'finding',
      title: 'Пока тихо',
      text: 'Данных за месяц ещё мало — наблюдения и советы появятся по мере заполнения дней.',
    });
  }

  return {
    ym,
    monthTitle: `${RU_MONTHS[m - 1]} ${y}`,
    daysInMonth,
    daysPassed,
    actualMonth,
    accruedMonth,
    actualPrev,
    incomeMonth,
    savedMonth,
    avgPerDay,
    forecastMonth,
    daily,
    groups,
    months,
    topExpenses,
    maxDay: maxDay && maxDay.amount > 0 ? maxDay : null,
    insights: insights.slice(0, 8),
  };
}
