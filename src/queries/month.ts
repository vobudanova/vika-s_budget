import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { daysInMonth, monthEnd, monthStart } from '@/lib/dates';
import { round2, toNum } from '@/lib/money';
import { getReference } from './core';

export type SheetRow = {
  key: string;
  name: string;
  days: number[]; // [0] не используется
  total: number;
  pendingDelete?: boolean;
  /** Обработчик корзинки (проставляется в клиентском компоненте). */
  onDelete?: () => void;
};
export type SheetSection = {
  key: string;
  title: string;
  tone: 'plain' | 'purchases' | 'amortization' | 'trips' | 'transfers' | 'ks' | 'savings';
  rows: SheetRow[];
  dayTotals: number[];
  total: number;
};
export type MonthSheet = {
  daysCount: number;
  sections: SheetSection[];
  accruedTotals: number[]; // операционные + амортизация + поездки
  actualTotals: number[]; // операционные + покупки + поездки
  accruedTotal: number;
  actualTotal: number;
  filledDays: number[]; // номера отмеченных дней
  pendingWarnings: { name: string; groupName: string; months: string[]; total: number }[];
};

const zeros = (n: number) => Array<number>(n + 1).fill(0);

export async function getMonthSheet(ym: string): Promise<MonthSheet> {
  const [y, m] = ym.split('-').map(Number);
  const daysCount = daysInMonth(y, m);
  const from = monthStart(ym);
  const to = monthEnd(ym);
  const ref = await getReference();

  const [expensesRes, purchasesRes, accrualsRes, transfersRes, ksRes, savingsRes, filledRes, pendingRes] =
    await Promise.all([
      db.execute(sql`
        SELECT category_id, EXTRACT(DAY FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_actual WHERE src = 'expense' AND date BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT category_id, EXTRACT(DAY FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_actual WHERE src = 'purchase' AND date BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT category_id, EXTRACT(DAY FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_accrued WHERE src = 'amortization' AND date BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT ca.type AS counter_type, EXTRACT(DAY FROM t.date)::int AS d, sum(t.amount) AS s
        FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
        WHERE t.kind = 'transfer' AND NOT t.hidden AND t.date BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT fm.fund_category_id, EXTRACT(DAY FROM fm.date)::int AS d, sum(-fm.amount) AS s
        FROM fund_movements fm
        WHERE fm.kind = 'reimbursement' AND fm.date BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT ca.name AS counter_name, EXTRACT(DAY FROM t.date)::int AS d, sum(t.amount) AS s
        FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
        WHERE t.kind = 'saving' AND NOT t.hidden AND t.date BETWEEN ${from} AND ${to}
        GROUP BY 1, 2
      `),
      db.execute(sql`SELECT EXTRACT(DAY FROM date)::int AS d FROM filled_days WHERE date BETWEEN ${from} AND ${to}`),
      db.execute(sql`
        SELECT c.id, c.name, cg.name AS group_name,
               to_char(t.date, 'YYYY-MM') AS ym, sum(t.amount) AS s
        FROM categories c
        JOIN category_groups cg ON cg.id = c.group_id
        LEFT JOIN transactions t ON t.category_id = c.id
        WHERE c.pending_delete
        GROUP BY c.id, c.name, cg.name, 4
      `),
    ]);

  const cellMap = (rows: unknown[], keyField: string) => {
    const map = new Map<string, number>();
    for (const r of rows as Array<Record<string, unknown>>) {
      map.set(`${r[keyField]}:${r.d}`, toNum(r.s as string));
    }
    return map;
  };
  const expenseCells = cellMap(expensesRes.rows, 'category_id');
  const purchaseCells = cellMap(purchasesRes.rows, 'category_id');
  const accrualCells = cellMap(accrualsRes.rows, 'category_id');
  const transferCells = cellMap(transfersRes.rows, 'counter_type');
  const ksCells = cellMap(ksRes.rows, 'fund_category_id');
  const savingCells = cellMap(savingsRes.rows, 'counter_name');

  const buildRows = (
    items: { key: string; name: string; pendingDelete?: boolean }[],
    cells: Map<string, number>,
  ) => {
    const rows: SheetRow[] = [];
    const dayTotals = zeros(daysCount);
    let total = 0;
    for (const it of items) {
      const days = zeros(daysCount);
      let rowTotal = 0;
      for (let d = 1; d <= daysCount; d++) {
        const v = cells.get(`${it.key}:${d}`) ?? 0;
        days[d] = v;
        rowTotal = round2(rowTotal + v);
        dayTotals[d] = round2(dayTotals[d] + v);
      }
      rows.push({ key: it.key, name: it.name, days, total: rowTotal, pendingDelete: it.pendingDelete });
      total = round2(total + rowTotal);
    }
    return { rows, dayTotals, total };
  };

  const sections: SheetSection[] = [];

  // Операционные группы трат — все категории, включая нулевые
  const expenseGroups = ref.groups.filter((g) => !['Покупки', 'Амортизация', 'Поездки'].includes(g.name));
  for (const g of expenseGroups) {
    const cats = ref.categories.filter((c) => c.groupId === g.id);
    if (cats.length === 0) continue;
    const built = buildRows(
      cats.map((c) => ({ key: String(c.id), name: c.name, pendingDelete: c.pendingDelete })),
      expenseCells,
    );
    sections.push({ key: `g${g.id}`, title: g.name, tone: 'plain', ...built });
  }

  // Покупки (фактический метод)
  const purchGroup = ref.groups.find((g) => g.name === 'Покупки');
  if (purchGroup) {
    const cats = ref.categories.filter((c) => c.groupId === purchGroup.id);
    sections.push({
      key: 'purchases',
      title: 'Покупки',
      tone: 'purchases',
      ...buildRows(cats.map((c) => ({ key: String(c.id), name: c.name })), purchaseCells),
    });
  }

  // Амортизация (начисленный метод)
  const amortGroup = ref.groups.find((g) => g.name === 'Амортизация');
  if (amortGroup) {
    const cats = ref.categories.filter((c) => c.groupId === amortGroup.id);
    sections.push({
      key: 'amortization',
      title: 'Амортизация',
      tone: 'amortization',
      ...buildRows(cats.map((c) => ({ key: String(c.id), name: c.name })), accrualCells),
    });
  }

  // Поездки
  const tripGroup = ref.groups.find((g) => g.name === 'Поездки');
  if (tripGroup) {
    const cats = ref.categories.filter((c) => c.groupId === tripGroup.id);
    sections.push({
      key: 'trips',
      title: 'Поездки',
      tone: 'trips',
      ...buildRows(
        cats.map((c) => ({ key: String(c.id), name: c.name, pendingDelete: c.pendingDelete })),
        expenseCells,
      ),
    });
  }

  // Переводы (по типу счёта-получателя)
  const transferRows = [
    { key: 'savings_cap', name: 'На КАП' },
    { key: 'savings_ks', name: 'На КС' },
    { key: 'cash', name: 'Снятие наличных' },
    { key: 'deposit', name: 'Вклады' },
    { key: 'receivable', name: 'В долг' },
    { key: 'checking', name: 'Другое' },
  ];
  sections.push({
    key: 'transfers',
    title: 'Переводы',
    tone: 'transfers',
    ...buildRows(transferRows, transferCells),
  });

  // Компенсировано из КС — все статьи фонда
  sections.push({
    key: 'ks',
    title: 'Компенсировано из КС',
    tone: 'ks',
    ...buildRows(
      ref.fundCategories.map((f) => ({ key: String(f.id), name: f.name })),
      ksCells,
    ),
  });

  // Сбережения — по инструментам
  const savingInstruments = ref.accounts
    .filter((a) => ['metals', 'brokerage', 'deposit', 'cash'].includes(a.type))
    .map((a) => ({ key: a.name, name: a.name }));
  sections.push({
    key: 'savings',
    title: 'Сбережения',
    tone: 'savings',
    ...buildRows(savingInstruments, savingCells),
  });

  // Итоги двух методов: операционные + поездки + (амортизация | покупки)
  const opers = sections.filter((s) => s.tone === 'plain' || s.tone === 'trips');
  const accruedTotals = zeros(daysCount);
  const actualTotals = zeros(daysCount);
  for (let d = 1; d <= daysCount; d++) {
    const oper = opers.reduce((sum, s) => round2(sum + s.dayTotals[d]), 0);
    const amort = sections.find((s) => s.key === 'amortization')?.dayTotals[d] ?? 0;
    const purch = sections.find((s) => s.key === 'purchases')?.dayTotals[d] ?? 0;
    accruedTotals[d] = round2(oper + amort);
    actualTotals[d] = round2(oper + purch);
  }
  const operTotal = opers.reduce((sum, s) => round2(sum + s.total), 0);
  const accruedTotal = round2(operTotal + (sections.find((s) => s.key === 'amortization')?.total ?? 0));
  const actualTotal = round2(operTotal + (sections.find((s) => s.key === 'purchases')?.total ?? 0));

  const filledDays = (filledRes.rows as Array<{ d: number }>).map((r) => r.d);

  // Предупреждения о категориях «к удалению» с данными
  const pendingMap = new Map<number, { name: string; groupName: string; months: string[]; total: number }>();
  for (const r of pendingRes.rows as Array<{ id: number; name: string; group_name: string; ym: string | null; s: string | null }>) {
    const id = Number(r.id);
    if (!pendingMap.has(id)) pendingMap.set(id, { name: r.name, groupName: r.group_name, months: [], total: 0 });
    const item = pendingMap.get(id)!;
    if (r.ym && toNum(r.s) !== 0) {
      item.months.push(r.ym);
      item.total = round2(item.total + toNum(r.s));
    }
  }
  const pendingWarnings = [...pendingMap.values()].filter((p) => p.months.length > 0);

  return { daysCount, sections, accruedTotals, actualTotals, accruedTotal, actualTotal, filledDays, pendingWarnings };
}
