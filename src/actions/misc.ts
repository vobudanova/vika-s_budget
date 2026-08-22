'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { isValidISODate } from '@/lib/dates';
import { parseAmountExpr, round2 } from '@/lib/money';

const { accountSnapshots, obligations, transactions, accounts, settings } = schema;

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

// ------------------------------------------------------------- снапшоты

const snapshotInput = z.object({
  accountId: z.coerce.number().int().positive(),
  onDate: dateSchema,
  balance: z.string().transform((s, ctx) => {
    const n = parseAmountExpr(s.replace(/^-/, '')) ?? NaN;
    const negative = s.trim().startsWith('-');
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
      return z.NEVER;
    }
    return negative ? -n : n;
  }),
  note: z.string().trim().max(300).optional(),
});

export async function saveSnapshot(raw: z.input<typeof snapshotInput>): Promise<ActionResult> {
  try {
    const input = snapshotInput.parse(raw);
    await db
      .insert(accountSnapshots)
      .values({
        accountId: input.accountId,
        onDate: input.onDate,
        balance: String(round2(input.balance)),
        note: input.note || null,
      })
      .onConflictDoUpdate({
        target: [accountSnapshots.accountId, accountSnapshots.onDate],
        set: { balance: String(round2(input.balance)), note: input.note || null },
      });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSnapshot(id: number): Promise<ActionResult> {
  try {
    await db.delete(accountSnapshots).where(eq(accountSnapshots.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------- обязательства

const obligationInput = z.object({
  title: z.string().trim().min(1, 'Опишите долг'),
  amount: z.string().transform((s, ctx) => {
    const n = parseAmountExpr(s);
    if (n === null || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
      return z.NEVER;
    }
    return n;
  }),
  debtor: z.string().trim().max(120).optional(),
  creditor: z.string().trim().max(120).optional(),
  openedAt: dateSchema,
  note: z.string().trim().max(500).optional(),
});

export async function createObligation(raw: z.input<typeof obligationInput>): Promise<ActionResult> {
  try {
    const input = obligationInput.parse(raw);
    await db.insert(obligations).values({
      title: input.title,
      amount: String(input.amount),
      debtor: input.debtor || 'должник',
      creditor: input.creditor || 'я',
      openedAt: input.openedAt,
      note: input.note || null,
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function closeObligation(id: number, closedAt: string): Promise<ActionResult> {
  try {
    await db
      .update(obligations)
      .set({ status: 'closed', closedAt })
      .where(eq(obligations.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Дать в долг: перевод на счёт «Выданные долги» + обязательство. */
const lendInput = z.object({
  date: dateSchema,
  amount: z.string().transform((s, ctx) => {
    const n = parseAmountExpr(s);
    if (n === null || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
      return z.NEVER;
    }
    return n;
  }),
  fromAccountId: z.coerce.number().int().positive('Счёт списания'),
  toWhom: z.string().trim().min(1, 'Кому — обязательно'),
  note: z.string().trim().max(500).optional(),
});

export async function lendMoney(raw: z.input<typeof lendInput>): Promise<ActionResult> {
  try {
    const input = lendInput.parse(raw);
    const [receivable] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.type, 'receivable'))
      .limit(1);
    if (!receivable) return { ok: false, error: 'Счёт «Выданные долги» не найден' };
    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        date: input.date,
        amount: String(input.amount),
        kind: 'transfer',
        accountId: input.fromAccountId,
        counterAccountId: receivable.id,
        note: `В долг: ${input.toWhom}${input.note ? ` · ${input.note}` : ''}`,
      });
      await tx.insert(obligations).values({
        title: `Долг: ${input.toWhom}`,
        amount: String(input.amount),
        debtor: input.toWhom,
        creditor: 'я',
        openedAt: input.date,
        note: input.note || null,
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- отметка «день заполнен»

export async function toggleFilledDay(date: string, filled: boolean): Promise<ActionResult> {
  try {
    if (!isValidISODate(date)) return { ok: false, error: 'Некорректная дата' };
    if (filled) {
      await db.insert(schema.filledDays).values({ date }).onConflictDoNothing();
    } else {
      await db.delete(schema.filledDays).where(eq(schema.filledDays.date, date));
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function isFilledDay(date: string): Promise<boolean> {
  const [row] = await db.select().from(schema.filledDays).where(eq(schema.filledDays.date, date));
  return !!row;
}

// ------------------------------------------------------------- настройки

export async function saveSetting(key: string, value: unknown): Promise<ActionResult> {
  try {
    await db
      .insert(settings)
      .values({ key, value: value as object })
      .onConflictDoUpdate({ target: settings.key, set: { value: value as object } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- процентные вклады

const openDepositInput = z.object({
  date: dateSchema,
  amount: z.string().transform((s, ctx) => {
    const n = parseAmountExpr(s);
    if (n === null || n <= 0) {
      ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
      return z.NEVER;
    }
    return n;
  }),
  name: z.string().trim().min(1, 'Название вклада'),
  fromAccountId: z.coerce.number().int().positive('Счёт-источник'),
  note: z.string().trim().max(300).optional(),
});

export async function openInterestDeposit(
  raw: z.input<typeof openDepositInput>,
): Promise<ActionResult> {
  try {
    const input = openDepositInput.parse(raw);
    await db.transaction(async (tx) => {
      const [dep] = await tx
        .insert(accounts)
        .values({
          name: input.name,
          type: 'deposit',
          depositKind: 'interest',
          sourceAccountId: input.fromAccountId,
          sortOrder: 50,
          note: input.note || null,
        })
        .returning();
      await tx.insert(transactions).values({
        date: input.date,
        amount: String(input.amount),
        kind: 'transfer',
        accountId: input.fromAccountId,
        counterAccountId: dep.id,
        note: `Открытие вклада «${input.name}»`,
      });
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const closeDepositInput = z.object({
  depositAccountId: z.coerce.number().int().positive(),
  date: dateSchema,
  interest: z.string().optional(), // полученные проценты
});

export async function closeInterestDeposit(
  raw: z.input<typeof closeDepositInput>,
): Promise<ActionResult> {
  try {
    const input = closeDepositInput.parse(raw);
    const [dep] = await db.select().from(accounts).where(eq(accounts.id, input.depositAccountId));
    if (!dep || dep.depositKind !== 'interest') {
      return { ok: false, error: 'Это не процентный вклад' };
    }
    const targetId = dep.sourceAccountId;
    if (!targetId) return { ok: false, error: 'У вклада не указан счёт-источник' };

    const balRes = await db.execute(
      sql`SELECT balance FROM v_account_balances WHERE account_id = ${dep.id}`,
    );
    const body = Number((balRes.rows as Array<{ balance: string }>)[0]?.balance ?? 0);
    if (body <= 0) return { ok: false, error: 'На вкладе нет средств' };

    const interest = input.interest ? (parseAmountExpr(input.interest) ?? 0) : 0;
    const [source] = await db
      .select()
      .from(schema.incomeSources)
      .where(eq(schema.incomeSources.name, 'Проценты по вкладам'));

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values({
        date: input.date,
        amount: String(round2(body)),
        kind: 'transfer',
        accountId: dep.id,
        counterAccountId: targetId,
        note: `Закрытие вклада «${dep.name}»`,
      });
      if (interest > 0) {
        await tx.insert(transactions).values({
          date: input.date,
          amount: String(round2(interest)),
          kind: 'income',
          incomeSourceId: source?.id,
          counterAccountId: targetId,
          note: `Проценты по вкладу «${dep.name}»`,
        });
      }
      await tx.update(accounts).set({ isActive: false }).where(eq(accounts.id, dep.id));
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ----------------------------------------------- история сверок счёта

export type SnapshotRow = { id: number; onDate: string; balance: number; note: string | null };

export async function listSnapshots(accountId: number): Promise<SnapshotRow[]> {
  const rows = await db
    .select()
    .from(accountSnapshots)
    .where(eq(accountSnapshots.accountId, Number(accountId)))
    .orderBy(sql`${accountSnapshots.onDate} DESC`);
  return rows.map((r) => ({
    id: r.id,
    onDate: r.onDate,
    balance: Number(r.balance),
    note: r.note,
  }));
}

const snapshotEdit = z.object({
  id: z.coerce.number().int().positive(),
  onDate: dateSchema,
  balance: z.coerce.number().finite(),
});

export async function updateSnapshot(raw: z.input<typeof snapshotEdit>): Promise<ActionResult> {
  try {
    const input = snapshotEdit.parse(raw);
    await db
      .update(accountSnapshots)
      .set({ onDate: input.onDate, balance: String(round2(input.balance)) })
      .where(eq(accountSnapshots.id, input.id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.message.includes('account_snapshots_uq')) {
      return { ok: false, error: 'На эту дату уже есть сверка — отредактируйте или удалите её' };
    }
    return fail(e);
  }
}
