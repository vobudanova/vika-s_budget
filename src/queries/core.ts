import { sql, and, eq, gte, lte, asc, desc, isNull, or } from 'drizzle-orm';
import { db, schema } from '@/db';
import { monthStart, monthEnd } from '@/lib/dates';
import { toNum } from '@/lib/money';

const { categories, categoryGroups, accounts, incomeSources, fundCategories, assetCategories } = schema;

// ----------------------------------------------------------------- балансы

export type AccountBalance = {
  accountId: number;
  name: string;
  type: string;
  currency: 'RUB' | 'USD';
  includeInTotal: boolean;
  sortOrder: number;
  lastSnapshotDate: string | null;
  balance: number;
};

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const rows = await db.execute(sql`
    SELECT account_id, name, type, currency, include_in_total, sort_order, last_snapshot_date, balance
    FROM v_account_balances
    ORDER BY sort_order, account_id
  `);
  return (rows.rows as any[]).map((r) => ({
    accountId: Number(r.account_id),
    name: r.name,
    type: r.type,
    currency: r.currency,
    includeInTotal: r.include_in_total,
    sortOrder: r.sort_order,
    lastSnapshotDate: r.last_snapshot_date,
    balance: toNum(r.balance),
  }));
}

export function splitBalances(balances: AccountBalance[]) {
  const totalRub = balances
    .filter((b) => b.includeInTotal && b.currency === 'RUB')
    .reduce((s, b) => s + b.balance, 0);
  const totalUsd = balances
    .filter((b) => b.includeInTotal && b.currency === 'USD')
    .reduce((s, b) => s + b.balance, 0);
  return { totalRub, totalUsd };
}

// ------------------------------------------------------------- итоги месяца

export type MonthTotals = {
  actual: number; // фактические (без поездок)
  accrued: number; // начисленные (без поездок)
  trips: number; // поездки за месяц
  amortization: number; // амортизация внутри начисленных
  income: number;
  ksReimbursed: number; // компенсировано из КС
  covered: number; // теневые расходы
  savings: number;
};

export async function getMonthTotals(ym: string): Promise<MonthTotals> {
  const from = monthStart(ym);
  const to = monthEnd(ym);
  const res = await db.execute(sql`
    SELECT
      (SELECT COALESCE(sum(amount),0) FROM v_expenses_actual WHERE date BETWEEN ${from} AND ${to} AND row_type = 'expense') AS actual,
      (SELECT COALESCE(sum(amount),0) FROM v_expenses_accrued WHERE date BETWEEN ${from} AND ${to} AND row_type = 'expense') AS accrued,
      (SELECT COALESCE(sum(amount),0) FROM v_expenses_actual WHERE date BETWEEN ${from} AND ${to} AND row_type = 'trip') AS trips,
      (SELECT COALESCE(sum(amount),0) FROM v_expenses_accrued WHERE date BETWEEN ${from} AND ${to} AND src = 'amortization') AS amortization,
      (SELECT COALESCE(sum(amount),0) FROM transactions WHERE kind = 'income' AND date BETWEEN ${from} AND ${to}) AS income,
      (SELECT COALESCE(sum(amount),0) FROM fund_movements WHERE kind = 'reimbursement' AND date BETWEEN ${from} AND ${to}) AS ks_reimbursed,
      (SELECT COALESCE(sum(amount),0) FROM transactions WHERE kind = 'expense' AND covered AND date BETWEEN ${from} AND ${to}) AS covered,
      (SELECT COALESCE(sum(amount),0) FROM transactions WHERE kind = 'saving' AND date BETWEEN ${from} AND ${to}) AS savings
  `);
  const r = (res.rows as any[])[0];
  return {
    actual: toNum(r.actual),
    accrued: toNum(r.accrued),
    trips: toNum(r.trips),
    amortization: toNum(r.amortization),
    income: toNum(r.income),
    ksReimbursed: toNum(r.ks_reimbursed),
    covered: toNum(r.covered),
    savings: toNum(r.savings),
  };
}

// ---------------------------------------------------------------- операции дня

export type TxRow = {
  id: number;
  date: string;
  amount: number;
  kind: string;
  note: string | null;
  covered: boolean;
  amountExpr: string | null;
  acquiredNote: string | null;
  fundAllocation: string | null;
  categoryId: number | null;
  categoryName: string | null;
  groupName: string | null;
  accountId: number | null;
  accountName: string | null;
  counterAccountId: number | null;
  counterAccountName: string | null;
  incomeSourceName: string | null;
  fundCategoryId: number | null;
  fundCategoryName: string | null;
  assetId: number | null;
};

export async function getTransactions(where: ReturnType<typeof sql>): Promise<TxRow[]> {
  const rows = await db.execute(sql`
    SELECT t.id, t.date, t.amount, t.amount_expr, t.kind, t.note, t.covered, t.acquired_note, t.fund_allocation,
           t.category_id, c.name AS category_name, cg.name AS group_name,
           t.account_id, a.name AS account_name,
           t.counter_account_id, ca.name AS counter_account_name,
           s.name AS income_source_name,
           t.fund_category_id, fc.name AS fund_category_name,
           t.asset_id
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN category_groups cg ON cg.id = c.group_id
    LEFT JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ca ON ca.id = t.counter_account_id
    LEFT JOIN income_sources s ON s.id = t.income_source_id
    LEFT JOIN fund_categories fc ON fc.id = t.fund_category_id
    WHERE ${where}
    ORDER BY t.date DESC, t.id DESC
  `);
  return (rows.rows as any[]).map(mapTx);
}

function mapTx(r: any): TxRow {
  return {
    id: Number(r.id),
    date: r.date,
    amount: toNum(r.amount),
    kind: r.kind,
    note: r.note,
    covered: r.covered,
    amountExpr: r.amount_expr,
    acquiredNote: r.acquired_note,
    fundAllocation: r.fund_allocation,
    categoryId: r.category_id ? Number(r.category_id) : null,
    categoryName: r.category_name,
    groupName: r.group_name,
    accountId: r.account_id ? Number(r.account_id) : null,
    accountName: r.account_name,
    counterAccountId: r.counter_account_id ? Number(r.counter_account_id) : null,
    counterAccountName: r.counter_account_name,
    incomeSourceName: r.income_source_name,
    fundCategoryId: r.fund_category_id ? Number(r.fund_category_id) : null,
    fundCategoryName: r.fund_category_name,
    assetId: r.asset_id ? Number(r.asset_id) : null,
  };
}

export async function getDayTransactions(date: string): Promise<TxRow[]> {
  return getTransactions(sql`t.date = ${date}`);
}

export async function getMonthTransactions(ym: string): Promise<TxRow[]> {
  return getTransactions(sql`t.date BETWEEN ${monthStart(ym)} AND ${monthEnd(ym)}`);
}

// ------------------------------------------------------------- справочники

export type Reference = Awaited<ReturnType<typeof getReference>>;

export async function getReference(forDate?: string) {
  const activeFilter = (t: { activeFrom: any; activeTo: any }) =>
    forDate
      ? and(lte(t.activeFrom, forDate), or(isNull(t.activeTo), gte(t.activeTo, forDate)))
      : undefined;

  const [groups, cats, accs, sources, fundCats, assetCats] = await Promise.all([
    db.select().from(categoryGroups).orderBy(asc(categoryGroups.sortOrder)),
    db
      .select()
      .from(categories)
      .where(activeFilter(categories))
      .orderBy(asc(categories.sortOrder)),
    db.select().from(accounts).where(eq(accounts.isActive, true)).orderBy(asc(accounts.sortOrder)),
    db
      .select()
      .from(incomeSources)
      .where(eq(incomeSources.isActive, true))
      .orderBy(asc(incomeSources.sortOrder)),
    db
      .select()
      .from(fundCategories)
      .where(activeFilter(fundCategories))
      .orderBy(asc(fundCategories.sortOrder)),
    db.select().from(assetCategories).orderBy(asc(assetCategories.sortOrder)),
  ]);

  return { groups, categories: cats, accounts: accs, incomeSources: sources, fundCategories: fundCats, assetCategories: assetCats };
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  return row ? (row.value as T) : fallback;
}

export { desc, asc, and, eq, gte, lte };
