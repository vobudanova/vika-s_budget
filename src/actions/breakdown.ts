'use server';

import { z } from 'zod';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { round2, toNum } from '@/lib/money';

export type CellItem = { date: string; label: string; sub?: string | null; amount: number; moveId?: number };
export type CellBreakdown = { items: CellItem[]; total: number };

const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const input = z.object({
  from: dateISO,
  to: dateISO,
  /** 'g<groupId>' | 'purchases' | 'amortization' | 'trips' | 'transfers' | 'ks' | 'savings' | 'top-accrued' | 'top-actual' */
  section: z.string().max(40),
  /** ключ строки внутри секции; null — строка-заголовок секции целиком */
  row: z.string().max(120).nullish(),
});

/** Из чего сложилось число в ячейке листа месяца/года. */
export async function getCellBreakdown(
  raw: z.input<typeof input>,
): Promise<CellBreakdown | { error: string }> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: 'Некорректный запрос' };
  const { from, to, section, row } = parsed.data;

  const rows: CellItem[] = [];
  const push = (res: { rows: unknown[] }) => {
    for (const r of res.rows as Array<Record<string, unknown>>) {
      rows.push({
        date: String(r.date),
        label: String(r.label ?? ''),
        sub: (r.sub as string | null) ?? null,
        amount: toNum(r.s as string),
        ...(r.move_id ? { moveId: Number(r.move_id) } : null),
      });
    }
  };

  const expenses = (extra: ReturnType<typeof sql>) => sql`
    SELECT v.date, c.name AS label, v.note AS sub, v.amount AS s
    FROM v_expenses_actual v JOIN categories c ON c.id = v.category_id
    WHERE v.src = 'expense' AND v.date BETWEEN ${from} AND ${to} AND ${extra}
    ORDER BY v.date, v.id`;

  try {
    if (section.startsWith('g')) {
      const groupId = Number(section.slice(1));
      push(
        await db.execute(
          expenses(row ? sql`v.category_id = ${Number(row)}` : sql`v.group_id = ${groupId}`),
        ),
      );
    } else if (section === 'trips') {
      push(
        await db.execute(
          expenses(row ? sql`v.category_id = ${Number(row)}` : sql`v.row_type = 'trip'`),
        ),
      );
    } else if (section === 'purchases') {
      push(
        await db.execute(sql`
          SELECT v.date, COALESCE(NULLIF(v.note, ''), c.name) AS label, c.name AS sub, v.amount AS s
          FROM v_expenses_actual v JOIN categories c ON c.id = v.category_id
          WHERE v.src = 'purchase' AND v.date BETWEEN ${from} AND ${to}
            AND ${row ? sql`v.category_id = ${Number(row)}` : sql`true`}
          ORDER BY v.date, v.id`),
      );
    } else if (section === 'amortization') {
      push(
        await db.execute(sql`
          SELECT v.date, COALESCE(NULLIF(v.note, ''), c.name) AS label, c.name AS sub, v.amount AS s
          FROM v_expenses_accrued v JOIN categories c ON c.id = v.category_id
          WHERE v.src = 'amortization' AND v.date BETWEEN ${from} AND ${to}
            AND ${row ? sql`v.category_id = ${Number(row)}` : sql`true`}
          ORDER BY v.date, v.id`),
      );
    } else if (section === 'transfers') {
      push(
        await db.execute(sql`
          SELECT t.date, ca.name AS label, t.note AS sub, t.amount AS s
          FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
          WHERE t.kind = 'transfer' AND NOT t.hidden AND t.date BETWEEN ${from} AND ${to}
            AND ${row ? sql`ca.type = ${row}` : sql`true`}
          ORDER BY t.date, t.id`),
      );
    } else if (section === 'ks') {
      push(
        await db.execute(sql`
          SELECT fm.id AS move_id, fm.date, fc.name AS label, fm.note AS sub, -fm.amount AS s
          FROM fund_movements fm JOIN fund_categories fc ON fc.id = fm.fund_category_id
          WHERE fm.kind = 'reimbursement' AND fm.date BETWEEN ${from} AND ${to}
            AND ${row ? sql`fm.fund_category_id = ${Number(row)}` : sql`true`}
          ORDER BY fm.date, fm.id`),
      );
    } else if (section === 'fund-in') {
      // «отложено» по статьям фонда: пополнения и корректировки
      push(
        await db.execute(sql`
          SELECT fm.id AS move_id, fm.date, fc.name AS label,
                 COALESCE(NULLIF(fm.note, ''),
                          CASE fm.kind WHEN 'plan_topup' THEN 'пополнение по плану'
                                       WHEN 'extra_topup' THEN 'доп. пополнение'
                                       ELSE 'корректировка' END) AS sub,
                 fm.amount AS s
          FROM fund_movements fm JOIN fund_categories fc ON fc.id = fm.fund_category_id
          WHERE fm.kind <> 'reimbursement' AND fm.date BETWEEN ${from} AND ${to}
            AND ${row ? sql`fm.fund_category_id = ${Number(row)}` : sql`true`}
          ORDER BY fm.date, fm.id`),
      );
    } else if (section === 'income') {
      // поступления: по источнику ('src:ID'), по категории ('type:T') или все
      const cond = !row
        ? sql`true`
        : row.startsWith('src:')
          ? sql`iso.id = ${Number(row.slice(4))}`
          : sql`iso.type = ${row.slice(5)}`;
      push(
        await db.execute(sql`
          SELECT t.date, iso.name AS label, t.note AS sub, t.amount AS s
          FROM transactions t JOIN income_sources iso ON iso.id = t.income_source_id
          WHERE t.kind = 'income' AND t.date BETWEEN ${from} AND ${to} AND ${cond}
          ORDER BY t.date, t.id`),
      );
    } else if (section === 'savings') {
      push(
        await db.execute(sql`
          SELECT t.date, ca.name AS label, COALESCE(t.acquired_note, t.note) AS sub, t.amount AS s
          FROM transactions t JOIN accounts ca ON ca.id = t.counter_account_id
          WHERE t.kind = 'saving' AND NOT t.hidden AND t.date BETWEEN ${from} AND ${to}
            AND ${row ? sql`ca.name = ${row}` : sql`true`}
          ORDER BY t.date, t.id`),
      );
    } else if (section === 'top-accrued' || section === 'top-actual') {
      push(await db.execute(expenses(sql`true`)));
      const second =
        section === 'top-accrued'
          ? sql`
            SELECT v.date, COALESCE(NULLIF(v.note, ''), c.name) AS label, 'амортизация' AS sub, v.amount AS s
            FROM v_expenses_accrued v JOIN categories c ON c.id = v.category_id
            WHERE v.src = 'amortization' AND v.date BETWEEN ${from} AND ${to}
            ORDER BY v.date, v.id`
          : sql`
            SELECT v.date, COALESCE(NULLIF(v.note, ''), c.name) AS label, 'покупка' AS sub, v.amount AS s
            FROM v_expenses_actual v JOIN categories c ON c.id = v.category_id
            WHERE v.src = 'purchase' AND v.date BETWEEN ${from} AND ${to}
            ORDER BY v.date, v.id`;
      push(await db.execute(second));
      rows.sort((a, b) => a.date.localeCompare(b.date));
    } else {
      return { error: 'Неизвестная строка таблицы' };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Не удалось загрузить' };
  }

  return {
    items: rows.slice(0, 400),
    total: round2(rows.reduce((s, r) => s + r.amount, 0)),
  };
}

export type AccountBreakdown = {
  snapshot: { date: string; balance: number } | null;
  items: CellItem[]; // суммы со знаком: + приход на счёт, − списание
  total: number; // = вычисленный баланс счёта
};

/** Как вычислился баланс счёта: последний снапшот + операции после него. */
export async function getAccountBreakdown(
  accountIdRaw: number,
): Promise<AccountBreakdown | { error: string }> {
  const accountId = Number(accountIdRaw);
  if (!Number.isInteger(accountId) || accountId <= 0) return { error: 'Некорректный счёт' };

  try {
    const snapRes = await db.execute(sql`
      SELECT on_date, balance FROM account_snapshots
      WHERE account_id = ${accountId} ORDER BY on_date DESC LIMIT 1
    `);
    const snapRow = (snapRes.rows as any[])[0];
    const snapshot = snapRow
      ? { date: String(snapRow.on_date), balance: toNum(snapRow.balance) }
      : null;

    const txRes = await db.execute(sql`
      SELECT t.date, t.kind, t.note, t.amount,
             (t.account_id = ${accountId}) AS is_out,
             c.name AS cat, iso.name AS source,
             acc.name AS acc_name, cacc.name AS counter_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN income_sources iso ON iso.id = t.income_source_id
      LEFT JOIN accounts acc ON acc.id = t.account_id
      LEFT JOIN accounts cacc ON cacc.id = t.counter_account_id
      WHERE (t.account_id = ${accountId} OR t.counter_account_id = ${accountId})
        AND t.date > ${snapshot?.date ?? '1899-12-31'}::date
      ORDER BY t.date, t.id
    `);

    const items: CellItem[] = (txRes.rows as any[]).map((r) => {
      const isOut = !!r.is_out;
      const amount = round2(isOut ? -toNum(r.amount) : toNum(r.amount));
      let label: string;
      switch (r.kind) {
        case 'expense':
          label = r.cat ?? 'Трата';
          break;
        case 'purchase':
          label = r.note || r.cat || 'Покупка';
          break;
        case 'income':
          label = r.source ?? 'Доход';
          break;
        case 'transfer':
        case 'saving':
          label = isOut ? `→ ${r.counter_name ?? 'счёт'}` : `← ${r.acc_name ?? 'счёт'}`;
          break;
        case 'reimbursement':
          label = 'Компенсация из КС';
          break;
        case 'asset_resale':
          label = 'Перепродажа';
          break;
        default:
          label = r.kind;
      }
      return {
        date: String(r.date),
        label,
        sub: label === r.note ? null : ((r.note as string | null) ?? null),
        amount,
      };
    });

    return {
      snapshot,
      items: items.slice(0, 400),
      total: round2((snapshot?.balance ?? 0) + items.reduce((s, i) => s + i.amount, 0)),
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Не удалось загрузить' };
  }
}
