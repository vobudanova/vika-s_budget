'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { isValidISODate } from '@/lib/dates';
import { parseAmountExpr, round2, toNum } from '@/lib/money';

const { fundCategories, fundMovements, transactions, accounts } = schema;

export type ActionResult = { ok: true } | { ok: false; error: string };
const revalidateAll = () => revalidatePath('/', 'layout');

function fail(e: unknown): ActionResult {
  const msg =
    e instanceof z.ZodError
      ? e.issues.map((i) => i.message).join('; ')
      : e instanceof Error
        ? e.message
        : 'Неизвестная ошибка';
  return { ok: false, error: msg };
}

const dateSchema = z.string().refine(isValidISODate, 'Некорректная дата');
const amountSchema = z.string().transform((s, ctx) => {
  const n = parseAmountExpr(s);
  if (n === null || n <= 0) {
    ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
    return z.NEVER;
  }
  return n;
});

async function ksAccount() {
  const [acc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.type, 'savings_ks'), eq(accounts.isActive, true)))
    .limit(1);
  return acc ?? null;
}

// -------------------------------------------------------------- компенсация

const reimburseInput = z.object({
  date: dateSchema,
  fundCategoryId: z.coerce.number().int().positive('Выберите статью'),
  amount: amountSchema,
  settle: z.enum(['from_account', 'offset_next_topup']),
  note: z.string().trim().max(500).optional(),
});

export async function createReimbursement(
  raw: z.input<typeof reimburseInput>,
): Promise<ActionResult> {
  try {
    const input = reimburseInput.parse(raw);
    await db.transaction(async (tx) => {
      let transactionId: number | undefined;
      if (input.settle === 'from_account') {
        const ks = await ksAccount();
        if (!ks) throw new Error('Счёт КС не найден');
        const [txn] = await tx
          .insert(transactions)
          .values({
            date: input.date,
            amount: String(input.amount),
            kind: 'reimbursement',
            accountId: ks.id,
            fundCategoryId: input.fundCategoryId,
            note: input.note || null,
          })
          .returning();
        transactionId = txn.id;
      }
      await tx.insert(fundMovements).values({
        fundCategoryId: input.fundCategoryId,
        date: input.date,
        amount: String(-input.amount),
        kind: 'reimbursement',
        settle: input.settle,
        transactionId,
        note: input.note || null,
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- пополнение по плану

const topupInput = z.object({
  date: dateSchema,
  fromAccountId: z.coerce.number().int().positive('Счёт списания'),
});

/**
 * Пополнение фонда: статьи получают полные плановые суммы, банковский перевод
 * уменьшается на незачтённые компенсации (settle = offset_next_topup).
 */
export async function topupFund(raw: z.input<typeof topupInput>): Promise<ActionResult> {
  try {
    const input = topupInput.parse(raw);
    const ks = await ksAccount();
    if (!ks) return { ok: false, error: 'Счёт КС не найден' };

    const cats = await db
      .select()
      .from(fundCategories)
      .where(gt(fundCategories.monthlyPlan, '0'));
    const activeCats = cats.filter(
      (c) => c.activeFrom <= input.date && (!c.activeTo || c.activeTo >= input.date),
    );
    if (activeCats.length === 0) return { ok: false, error: 'Нет статей с планом' };
    const planTotal = round2(activeCats.reduce((s, c) => s + toNum(c.monthlyPlan), 0));

    const offsets = await db
      .select()
      .from(fundMovements)
      .where(
        and(
          eq(fundMovements.kind, 'reimbursement'),
          eq(fundMovements.settle, 'offset_next_topup'),
          isNull(fundMovements.offsetAppliedAt),
        ),
      );
    const offsetTotal = round2(offsets.reduce((s, m) => s + Math.abs(toNum(m.amount)), 0));
    const transferAmount = round2(planTotal - offsetTotal);

    await db.transaction(async (tx) => {
      let transactionId: number | undefined;
      if (transferAmount > 0) {
        const [txn] = await tx
          .insert(transactions)
          .values({
            date: input.date,
            amount: String(transferAmount),
            kind: 'transfer',
            accountId: input.fromAccountId,
            counterAccountId: ks.id,
            note:
              offsetTotal > 0
                ? `Пополнение КС (план ${planTotal.toFixed(0)} − зачёты ${offsetTotal.toFixed(0)})`
                : 'Пополнение КС по плану',
          })
          .returning();
        transactionId = txn.id;
      }
      for (const c of activeCats) {
        await tx.insert(fundMovements).values({
          fundCategoryId: c.id,
          date: input.date,
          amount: String(toNum(c.monthlyPlan)),
          kind: 'plan_topup',
          transactionId,
        });
      }
      for (const o of offsets) {
        await tx
          .update(fundMovements)
          .set({ offsetAppliedAt: input.date })
          .where(eq(fundMovements.id, o.id));
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- внеплановое пополнение

const extraTopupInput = z.object({
  date: dateSchema,
  fundCategoryId: z.coerce.number().int().positive('Выберите статью'),
  amount: amountSchema,
  fromAccountId: z.coerce.number().int().positive().nullish(),
  note: z.string().trim().max(500).optional(),
});

export async function extraTopupFund(raw: z.input<typeof extraTopupInput>): Promise<ActionResult> {
  try {
    const input = extraTopupInput.parse(raw);
    await db.transaction(async (tx) => {
      let transactionId: number | undefined;
      if (input.fromAccountId) {
        const ks = await ksAccount();
        if (!ks) throw new Error('Счёт КС не найден');
        const [txn] = await tx
          .insert(transactions)
          .values({
            date: input.date,
            amount: String(input.amount),
            kind: 'transfer',
            accountId: input.fromAccountId,
            counterAccountId: ks.id,
            note: input.note || 'Внеплановое пополнение КС',
          })
          .returning();
        transactionId = txn.id;
      }
      await tx.insert(fundMovements).values({
        fundCategoryId: input.fundCategoryId,
        date: input.date,
        amount: String(input.amount),
        kind: 'extra_topup',
        transactionId,
        note: input.note || null,
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------- корректировка

const adjustInput = z.object({
  date: dateSchema,
  fundCategoryId: z.coerce.number().int().positive(),
  amount: z.coerce.number(),
  note: z.string().trim().max(500).optional(),
});

export async function adjustFund(raw: z.input<typeof adjustInput>): Promise<ActionResult> {
  try {
    const input = adjustInput.parse(raw);
    if (!input.amount) return { ok: false, error: 'Сумма не может быть нулевой' };
    await db.insert(fundMovements).values({
      fundCategoryId: input.fundCategoryId,
      date: input.date,
      amount: String(round2(input.amount)),
      kind: 'adjustment',
      note: input.note || 'Корректировка',
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFundMovement(id: number): Promise<ActionResult> {
  try {
    const [m] = await db.select().from(fundMovements).where(eq(fundMovements.id, id));
    if (!m) return { ok: false, error: 'Движение не найдено' };
    await db.transaction(async (tx) => {
      await tx.delete(fundMovements).where(eq(fundMovements.id, id));
      if (m.transactionId) {
        const rest = await tx
          .select({ id: fundMovements.id })
          .from(fundMovements)
          .where(eq(fundMovements.transactionId, m.transactionId))
          .limit(1);
        if (rest.length === 0) {
          await tx.delete(transactions).where(eq(transactions.id, m.transactionId));
        }
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------- постраничный список движений

export type FundMoveCursor = { date: string; id: number };
export type FundMoveRow = {
  id: number;
  date: string;
  amount: number;
  kind: string;
  settle: string | null;
  note: string | null;
  categoryName: string;
  groupName: string | null;
};

/** Страница движений фонда КС для бесконечного списка (50 шт., курсор date+id). */
export async function listFundMovesPage(
  cursor: FundMoveCursor | null,
): Promise<{ items: FundMoveRow[]; nextCursor: FundMoveCursor | null }> {
  const limit = 50;
  const rows = await db.execute(sql`
    SELECT m.id, m.date, m.amount, m.kind, m.settle, m.note,
           fc.name AS category_name, fc.group_name
    FROM fund_movements m
    JOIN fund_categories fc ON fc.id = m.fund_category_id
    ${cursor ? sql`WHERE (m.date, m.id) < (${cursor.date}::date, ${cursor.id})` : sql``}
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${limit + 1}
  `);
  const mapped: FundMoveRow[] = (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    date: String(r.date),
    amount: toNum(r.amount),
    kind: String(r.kind),
    settle: r.settle ?? null,
    note: r.note ?? null,
    categoryName: String(r.category_name),
    groupName: r.group_name ?? null,
  }));
  const items = mapped.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: mapped.length > limit && last ? { date: last.date, id: last.id } : null,
  };
}
