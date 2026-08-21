import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { round2, toNum } from '@/lib/money';
import { getReference } from './core';
import type { SheetRow, SheetSection } from './month';

export type YearSheet = {
  sections: SheetSection[]; // days = месяцы 1..12
  accruedTotals: number[];
  actualTotals: number[];
  accruedTotal: number;
  actualTotal: number;
  income: SheetRow[];
  incomeTotals: number[];
  incomeYear: number;
  savingsTotals: number[];
  savingsYear: number;
  ksReimbursedYear: number;
  coveredYear: number;
  pendingWarnings: { name: string; groupName: string; months: string[]; total: number }[];
};

const zeros = () => Array<number>(13).fill(0);

export async function getYearSheet(year: string): Promise<YearSheet> {
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;
  const ref = await getReference();

  const [expensesRes, purchasesRes, accrualsRes, transfersRes, ksRes, savingsByRes, incomeRes, savingsRes, extraRes, pendingRes] =
    await Promise.all([
      db.execute(sql`
        SELECT category_id, EXTRACT(MONTH FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_actual WHERE src = 'expense' AND date BETWEEN ${from} AND ${to} GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT category_id, EXTRACT(MONTH FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_actual WHERE src = 'purchase' AND date BETWEEN ${from} AND ${to} GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT category_id, EXTRACT(MONTH FROM date)::int AS d, sum(amount) AS s
        FROM v_expenses_accrued WHERE src = 'amortization' AND date BETWEEN ${from} AND ${to} GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT ca.type AS k, EXTRACT(MONTH FROM t.date)::int AS d, sum(t.amount) AS s
        FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
        WHERE t.kind = 'transfer' AND t.date BETWEEN ${from} AND ${to} GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT fm.fund_category_id AS k, EXTRACT(MONTH FROM fm.date)::int AS d, sum(-fm.amount) AS s
        FROM fund_movements fm WHERE fm.kind = 'reimbursement' AND fm.date BETWEEN ${from} AND ${to} GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT ca.name AS k, EXTRACT(MONTH FROM t.date)::int AS d, sum(t.amount) AS s
        FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
        WHERE t.kind = 'saving' AND t.date BETWEEN ${from} AND ${to} GROUP BY 1, 2
      `),
      db.execute(sql`
        SELECT s.name AS k, EXTRACT(MONTH FROM t.date)::int AS d, sum(t.amount) AS s
        FROM transactions t JOIN income_sources s ON s.id = t.income_source_id
        WHERE t.kind = 'income' AND t.date BETWEEN ${from} AND ${to}
        GROUP BY s.name, s.sort_order, 2 ORDER BY s.sort_order
      `),
      db.execute(sql`
        SELECT EXTRACT(MONTH FROM date)::int AS d, sum(amount) AS s
        FROM transactions WHERE kind = 'saving' AND date BETWEEN ${from} AND ${to} GROUP BY 1
      `),
      db.execute(sql`
        SELECT
          (SELECT COALESCE(sum(-amount), 0) FROM fund_movements
            WHERE kind = 'reimbursement' AND date BETWEEN ${from} AND ${to}) AS ks,
          (SELECT COALESCE(sum(amount), 0) FROM transactions
            WHERE kind = 'expense' AND covered AND date BETWEEN ${from} AND ${to}) AS covered
      `),
      db.execute(sql`
        SELECT c.id, c.name, cg.name AS group_name, to_char(t.date, 'YYYY-MM') AS ym, sum(t.amount) AS s
        FROM categories c
        JOIN category_groups cg ON cg.id = c.group_id
        LEFT JOIN transactions t ON t.category_id = c.id
        WHERE c.pending_delete
        GROUP BY c.id, c.name, cg.name, 4
      `),
    ]);

  const cellMap = (rows: unknown[]) => {
    const map = new Map<string, number>();
    for (const r of rows as Array<{ k?: unknown; category_id?: unknown; d: number; s: string }>) {
      map.set(`${r.k ?? r.category_id}:${r.d}`, toNum(r.s));
    }
    return map;
  };
  const expenseCells = cellMap(expensesRes.rows);
  const purchaseCells = cellMap(purchasesRes.rows);
  const accrualCells = cellMap(accrualsRes.rows);
  const transferCells = cellMap(transfersRes.rows);
  const ksCells = cellMap(ksRes.rows);
  const savingCells = cellMap(savingsByRes.rows);
  const incomeCells = cellMap(incomeRes.rows);

  const buildRows = (items: { key: string; name: string; pendingDelete?: boolean }[], cells: Map<string, number>) => {
    const rows: SheetRow[] = [];
    const dayTotals = zeros();
    let total = 0;
    for (const it of items) {
      const days = zeros();
      let rowTotal = 0;
      for (let d = 1; d <= 12; d++) {
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
  const expenseGroups = ref.groups.filter((g) => !['Покупки', 'Амортизация', 'Поездки'].includes(g.name));
  for (const g of expenseGroups) {
    const cats = ref.categories.filter((c) => c.groupId === g.id);
    if (cats.length === 0) continue;
    sections.push({
      key: `g${g.id}`,
      title: g.name,
      tone: 'plain',
      ...buildRows(cats.map((c) => ({ key: String(c.id), name: c.name, pendingDelete: c.pendingDelete })), expenseCells),
    });
  }
  const purchGroup = ref.groups.find((g) => g.name === 'Покупки');
  if (purchGroup) {
    sections.push({
      key: 'purchases',
      title: 'Покупки',
      tone: 'purchases',
      ...buildRows(
        ref.categories.filter((c) => c.groupId === purchGroup.id).map((c) => ({ key: String(c.id), name: c.name })),
        purchaseCells,
      ),
    });
  }
  const amortGroup = ref.groups.find((g) => g.name === 'Амортизация');
  if (amortGroup) {
    sections.push({
      key: 'amortization',
      title: 'Амортизация',
      tone: 'amortization',
      ...buildRows(
        ref.categories.filter((c) => c.groupId === amortGroup.id).map((c) => ({ key: String(c.id), name: c.name })),
        accrualCells,
      ),
    });
  }
  const tripGroup = ref.groups.find((g) => g.name === 'Поездки');
  if (tripGroup) {
    sections.push({
      key: 'trips',
      title: 'Поездки',
      tone: 'trips',
      ...buildRows(
        ref.categories
          .filter((c) => c.groupId === tripGroup.id)
          .map((c) => ({ key: String(c.id), name: c.name, pendingDelete: c.pendingDelete })),
        expenseCells,
      ),
    });
  }
  sections.push({
    key: 'transfers',
    title: 'Переводы',
    tone: 'transfers',
    ...buildRows(
      [
        { key: 'savings_cap', name: 'На КАП' },
        { key: 'savings_ks', name: 'На КС' },
        { key: 'cash', name: 'Снятие наличных' },
        { key: 'deposit', name: 'Вклады' },
        { key: 'receivable', name: 'В долг' },
        { key: 'checking', name: 'Другое' },
      ],
      transferCells,
    ),
  });
  sections.push({
    key: 'ks',
    title: 'Компенсировано из КС',
    tone: 'ks',
    ...buildRows(ref.fundCategories.map((f) => ({ key: String(f.id), name: f.name })), ksCells),
  });
  sections.push({
    key: 'savings',
    title: 'Сбережения',
    tone: 'savings',
    ...buildRows(
      ref.accounts
        .filter((a) => ['metals', 'brokerage', 'deposit', 'cash'].includes(a.type))
        .map((a) => ({ key: a.name, name: a.name })),
      savingCells,
    ),
  });

  const opers = sections.filter((s) => s.tone === 'plain' || s.tone === 'trips');
  const accruedTotals = zeros();
  const actualTotals = zeros();
  for (let d = 1; d <= 12; d++) {
    const oper = opers.reduce((sum, s) => round2(sum + s.dayTotals[d]), 0);
    accruedTotals[d] = round2(oper + (sections.find((s) => s.key === 'amortization')?.dayTotals[d] ?? 0));
    actualTotals[d] = round2(oper + (sections.find((s) => s.key === 'purchases')?.dayTotals[d] ?? 0));
  }
  const operTotal = opers.reduce((sum, s) => round2(sum + s.total), 0);
  const accruedTotal = round2(operTotal + (sections.find((s) => s.key === 'amortization')?.total ?? 0));
  const actualTotal = round2(operTotal + (sections.find((s) => s.key === 'purchases')?.total ?? 0));

  // Доходы по источникам
  const sourceNames = [...new Set((incomeRes.rows as Array<{ k: string }>).map((r) => r.k))];
  const incomeBuilt = buildRows(sourceNames.map((n) => ({ key: n, name: n })), incomeCells);

  const savingsTotals = zeros();
  for (const r of savingsRes.rows as Array<{ d: number; s: string }>) savingsTotals[r.d] = toNum(r.s);
  const extra = (extraRes.rows as Array<{ ks: string; covered: string }>)[0];

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

  return {
    sections,
    accruedTotals,
    actualTotals,
    accruedTotal,
    actualTotal,
    income: incomeBuilt.rows,
    incomeTotals: incomeBuilt.dayTotals,
    incomeYear: incomeBuilt.total,
    savingsTotals,
    savingsYear: round2(savingsTotals.reduce((s, v) => s + v, 0)),
    ksReimbursedYear: toNum(extra?.ks),
    coveredYear: toNum(extra?.covered),
    pendingWarnings: [...pendingMap.values()],
  };
}
