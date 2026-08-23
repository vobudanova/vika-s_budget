'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { getTransactions, type TxRow } from '@/queries/core';
import { parseAmountExpr } from '@/lib/money';
import { isValidISODate } from '@/lib/dates';

const { transactions, fundMovements, capMovements, accounts } = schema;

function revalidateAll() {
  revalidatePath('/', 'layout');
}

const dateSchema = z.string().refine(isValidISODate, 'Некорректная дата');
const amountSchema = z
  .string()
  .transform((s, ctx) => {
    const n = parseAmountExpr(s);
    if (n === null || n === 0) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
      return z.NEVER;
    }
    return n;
  });

export type ActionResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  const msg =
    e instanceof z.ZodError
      ? e.issues.map((i) => i.message).join('; ')
      : e instanceof Error
        ? e.message
        : 'Неизвестная ошибка';
  return { ok: false, error: msg };
}

// ------------------------------------------------------------------- траты

const expenseInput = z.object({
  date: dateSchema,
  amount: amountSchema,
  categoryId: z.coerce.number().int().positive('Выберите категорию'),
  accountId: z.coerce.number().int().positive().nullish(),
  note: z.string().trim().max(500).optional(),
  refund: z.boolean().optional(),
  covered: z.boolean().optional(),
});

/** Выражение сохраняется как введено («300+500-200»), если это не просто число. */
function exprOf(raw: string | undefined): string | null {
  const s = (raw ?? '').trim();
  if (!s) return null;
  return /^[-+]?\d+([.,]\d+)?$/.test(s) ? null : s;
}

export async function createExpense(raw: z.input<typeof expenseInput>): Promise<ActionResult> {
  try {
    const input = expenseInput.parse(raw);
    const amount = input.refund ? -Math.abs(input.amount) : Math.abs(input.amount);
    await db.insert(transactions).values({
      date: input.date,
      amount: String(amount),
      amountExpr: exprOf(typeof raw.amount === 'string' ? raw.amount : undefined),
      kind: 'expense',
      categoryId: input.categoryId,
      accountId: input.accountId ?? undefined,
      note: input.note || null,
      covered: input.covered ?? false,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------- доход

const incomeInput = z.object({
  date: dateSchema,
  amount: amountSchema,
  incomeSourceId: z.coerce.number().int().positive('Выберите источник'),
  counterAccountId: z.coerce.number().int().positive('Выберите счёт'),
  note: z.string().trim().max(500).optional(),
});

export async function createIncome(raw: z.input<typeof incomeInput>): Promise<ActionResult> {
  try {
    const input = incomeInput.parse(raw);
    await db.insert(transactions).values({
      date: input.date,
      amount: String(input.amount),
      kind: 'income',
      incomeSourceId: input.incomeSourceId,
      counterAccountId: input.counterAccountId,
      note: input.note || null,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Компенсация от Олега (предварительная схема, вопрос №22):
 * трата становится «теневой» (covered), приход разбивается на покрытие
 * (не доход) и остаток-доход «Компенсации».
 */
const compensationInput = z.object({
  date: dateSchema,
  spentAmount: amountSchema,
  receivedAmount: amountSchema,
  categoryId: z.coerce.number().int().positive('Выберите категорию траты'),
  accountId: z.coerce.number().int().positive('Счёт списания'),
  counterAccountId: z.coerce.number().int().positive('Счёт зачисления'),
  incomeSourceId: z.coerce.number().int().positive(),
  note: z.string().trim().max(500).optional(),
});

export async function createCompensation(
  raw: z.input<typeof compensationInput>,
): Promise<ActionResult> {
  try {
    const input = compensationInput.parse(raw);
    if (input.receivedAmount < input.spentAmount) {
      return { ok: false, error: 'Получено меньше, чем потрачено — это не компенсация' };
    }
    const surplus = Math.round((input.receivedAmount - input.spentAmount) * 100) / 100;
    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        date: input.date,
        amount: String(input.spentAmount),
        kind: 'expense',
        categoryId: input.categoryId,
        accountId: input.accountId,
        covered: true,
        note: input.note ? `${input.note} (покрыто компенсацией)` : 'Покрыто компенсацией',
      });
      await tx.insert(transactions).values({
        date: input.date,
        amount: String(input.spentAmount),
        kind: 'coverage_in',
        counterAccountId: input.counterAccountId,
        note: 'Покрытие теневой траты',
      });
      if (surplus > 0) {
        await tx.insert(transactions).values({
          date: input.date,
          amount: String(surplus),
          kind: 'income',
          incomeSourceId: input.incomeSourceId,
          counterAccountId: input.counterAccountId,
          note: input.note || 'Остаток компенсации',
        });
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------- переводы и сбережения

const transferInput = z.object({
  date: dateSchema,
  amount: amountSchema,
  accountId: z.coerce.number().int().positive('Счёт-источник'),
  counterAccountId: z.coerce.number().int().positive('Счёт-получатель'),
  fundAllocation: z.enum(['cap', 'ks']).nullish(),
  note: z.string().trim().max(500).optional(),
});

export async function createTransfer(raw: z.input<typeof transferInput>): Promise<ActionResult> {
  try {
    const input = transferInput.parse(raw);
    if (input.accountId === input.counterAccountId) {
      return { ok: false, error: 'Счёт-источник и получатель совпадают' };
    }
    await db.insert(transactions).values({
      date: input.date,
      amount: String(input.amount),
      kind: 'transfer',
      accountId: input.accountId,
      counterAccountId: input.counterAccountId,
      fundAllocation: input.fundAllocation ?? undefined,
      note: input.note || null,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const savingInput = z.object({
  date: dateSchema,
  amount: amountSchema,
  accountId: z.coerce.number().int().positive('Счёт-источник'),
  counterAccountId: z.coerce.number().int().positive('Инструмент сбережения'),
  acquiredNote: z.string().trim().max(300).optional(),
  fundAllocation: z.enum(['cap', 'ks']).nullish(),
  note: z.string().trim().max(500).optional(),
});

export async function createSaving(raw: z.input<typeof savingInput>): Promise<ActionResult> {
  try {
    const input = savingInput.parse(raw);
    await db.insert(transactions).values({
      date: input.date,
      amount: String(input.amount),
      kind: 'saving',
      accountId: input.accountId,
      counterAccountId: input.counterAccountId,
      acquiredNote: input.acquiredNote || null,
      fundAllocation: input.fundAllocation ?? undefined,
      note: input.note || null,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------------ удаление

export async function deleteTransaction(id: number): Promise<ActionResult> {
  try {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (!tx) return { ok: false, error: 'Операция не найдена' };
    if (tx.kind === 'purchase' && tx.assetId) {
      return {
        ok: false,
        error: 'Это покупка с амортизацией — удаляйте её на странице «Амортизация»',
      };
    }
    const [capLink] = await db
      .select({ id: capMovements.id })
      .from(capMovements)
      .where(eq(capMovements.transactionId, id))
      .limit(1);
    if (capLink) {
      return { ok: false, error: 'К переводу привязаны взносы КАП — управляйте им на странице «КАП»' };
    }
    await db.transaction(async (t) => {
      await t.delete(fundMovements).where(eq(fundMovements.transactionId, id));
      await t.delete(transactions).where(eq(transactions.id, id));
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- обновление

const updateInput = z.object({
  id: z.coerce.number().int().positive(),
  date: dateSchema.optional(),
  amount: amountSchema.optional(),
  categoryId: z.coerce.number().int().positive().nullish(),
  accountId: z.coerce.number().int().positive().nullish(),
  note: z.string().trim().max(500).nullish(),
  hidden: z.boolean().optional(),
});

export async function updateTransaction(raw: z.input<typeof updateInput>): Promise<ActionResult> {
  try {
    const input = updateInput.parse(raw);
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, input.id));
    if (!tx) return { ok: false, error: 'Операция не найдена' };
    if (tx.kind === 'purchase') {
      return { ok: false, error: 'Покупку редактируйте на странице «Амортизация»' };
    }
    await db
      .update(transactions)
      .set({
        ...(input.date ? { date: input.date } : {}),
        ...(input.amount !== undefined
          ? {
              amount: String(
                tx.amount && Number(tx.amount) < 0 ? -Math.abs(input.amount) : input.amount,
              ),
              amountExpr: exprOf(typeof raw.amount === 'string' ? raw.amount : undefined),
            }
          : {}),
        ...(input.categoryId !== undefined && input.categoryId !== null
          ? { categoryId: input.categoryId }
          : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.note !== undefined ? { note: input.note || null } : {}),
        ...(input.hidden !== undefined ? { hidden: input.hidden } : {}),
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, input.id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Счёт по умолчанию (дебетовая карта)
export async function getDefaultAccountId(): Promise<number | null> {
  const [acc] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.type, 'checking'), eq(accounts.isActive, true)))
    .limit(1);
  return acc?.id ?? null;
}

// ------------------------------------------- постраничный список доходов

export type IncomeCursor = { date: string; id: number };

/** Страница доходов для бесконечного списка: 50 операций, курсор (date, id). */
export async function listIncomePage(
  cursor: IncomeCursor | null,
): Promise<{ items: TxRow[]; nextCursor: IncomeCursor | null }> {
  const limit = 50;
  const where = cursor
    ? sql`t.kind IN ('income', 'coverage_in') AND (t.date, t.id) < (${cursor.date}::date, ${cursor.id})`
    : sql`t.kind IN ('income', 'coverage_in')`;
  const rows = await getTransactions(where, limit + 1);
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? { date: last.date, id: last.id } : null,
  };
}

// ------------------------------------------------------------------- поиск

/** Поиск по операциям: каждый токен ищется в заметках, названиях категорий,
    счетов, источников и статей; числовой токен дополнительно сверяется с суммой. */
export async function searchTransactions(
  q: string,
  cursor: IncomeCursor | null,
): Promise<{ items: TxRow[]; nextCursor: IncomeCursor | null }> {
  const tokens = q.trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (tokens.length === 0) return { items: [], nextCursor: null };
  const limit = 50;

  // регистр складываем через ICU: локаль базы может быть C, где lower()/ILIKE
  // не работают для кириллицы
  const fold = (f: string) => `lower(${f} COLLATE "und-x-icu")`;
  const FIELDS = ['t.note', 't.acquired_note', 'c.name', 'cg.name', 'a.name', 'ca.name', 's.name', 'fc.name'];
  const conds = tokens.map((tok) => {
    const like = `%${tok.toLowerCase()}%`;
    const num = Number(tok.replace(/\s/g, '').replace(',', '.'));
    const numeric = Number.isFinite(num) && /^[\d\s.,]+$/.test(tok);
    const fieldConds = FIELDS.map((f) => sql`${sql.raw(fold(f))} LIKE ${like}`);
    return sql`(${sql.join(fieldConds, sql` OR `)}${numeric ? sql` OR abs(t.amount) = ${num}` : sql``})`;
  });
  const where = cursor
    ? sql`${sql.join(conds, sql` AND `)} AND (t.date, t.id) < (${cursor.date}::date, ${cursor.id})`
    : sql.join(conds, sql` AND `);

  const rows = await getTransactions(where, limit + 1);
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: rows.length > limit && last ? { date: last.date, id: last.id } : null,
  };
}
