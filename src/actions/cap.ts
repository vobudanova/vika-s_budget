'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq, gte, isNull, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@/db';
import { monthEnd, monthStart, monthsBetweenInclusive, todayISO, ymOf, isValidYM } from '@/lib/dates';
import { fmtMoney, parseAmountExpr, round2, toNum } from '@/lib/money';
import { buildRedistributionPlan, getCapOverview } from '@/queries/cap';

const { capGoals, capMovements, transactions, accounts } = schema;

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

async function ksOrCapAccount(type: 'savings_cap' | 'savings_ks') {
  const [acc] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.type, type), eq(accounts.isActive, true)))
    .limit(1);
  return acc ?? null;
}

// ------------------------------------------------- флажок взноса за месяц

const toggleInput = z.object({
  goalId: z.coerce.number().int().positive(),
  ym: z.string().refine(isValidYM, 'Некорректный месяц'),
  amount: z.string().optional(), // переопределение суммы взноса
});

export async function toggleCapContribution(
  raw: z.input<typeof toggleInput>,
): Promise<ActionResult> {
  try {
    const input = toggleInput.parse(raw);
    const [goal] = await db.select().from(capGoals).where(eq(capGoals.id, input.goalId));
    if (!goal) return { ok: false, error: 'Цель не найдена' };
    if (goal.spentAt) return { ok: false, error: 'Цель уже потрачена' };

    const existing = await db
      .select()
      .from(capMovements)
      .where(
        and(
          eq(capMovements.capGoalId, input.goalId),
          eq(capMovements.source, 'own_funds'),
          gte(capMovements.date, monthStart(input.ym)),
          lte(capMovements.date, monthEnd(input.ym)),
        ),
      );

    if (existing.length > 0) {
      if (existing.some((m) => m.transactionId)) {
        return {
          ok: false,
          error: 'Взнос уже отправлен единым платежом — удалите платёж, чтобы снять флажок',
        };
      }
      await db.delete(capMovements).where(
        and(
          eq(capMovements.capGoalId, input.goalId),
          eq(capMovements.source, 'own_funds'),
          gte(capMovements.date, monthStart(input.ym)),
          lte(capMovements.date, monthEnd(input.ym)),
        ),
      );
    } else {
      let amount = input.amount ? parseAmountExpr(input.amount) : toNum(goal.monthlyContribution);
      if (!amount || amount <= 0) return { ok: false, error: 'Некорректная сумма взноса' };
      if (!input.amount) {
        // последний взнос добирает копеечный остаток до цели (месячный взнос
        // округлён, и N×взнос не сходится с целью — как 12×265,83 ≠ 3 190,00);
        // а если осталось меньше месячного — не переливаем сверх цели
        const [led] = (
          await db
            .select({ s: sql<string>`COALESCE(sum(${capMovements.amount}), 0)` })
            .from(capMovements)
            .where(eq(capMovements.capGoalId, input.goalId))
        );
        const remaining = round2(toNum(goal.targetAmount) - toNum(led?.s));
        if (remaining > 0 && remaining <= amount + 1) amount = remaining;
      }
      const today = todayISO();
      const date = ymOf(today) === input.ym ? today : monthStart(input.ym);
      await db.insert(capMovements).values({
        capGoalId: input.goalId,
        date,
        amount: String(round2(amount)),
        source: 'own_funds',
      });
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------- единый платёж по флажкам на счёт КАП

const paymentInput = z.object({
  fromAccountId: z.coerce.number().int().positive('Счёт списания'),
});

export async function sendCapPayment(raw: z.input<typeof paymentInput>): Promise<ActionResult> {
  try {
    const input = paymentInput.parse(raw);
    const capAccount = await ksOrCapAccount('savings_cap');
    if (!capAccount) return { ok: false, error: 'Счёт КАП не найден' };

    // все неотправленные взносы, любые месяцы; потраченные цели не трогаем
    const pending = await db
      .select({ id: capMovements.id, amount: capMovements.amount })
      .from(capMovements)
      .innerJoin(capGoals, eq(capGoals.id, capMovements.capGoalId))
      .where(
        and(
          eq(capMovements.source, 'own_funds'),
          isNull(capMovements.transactionId),
          isNull(capGoals.spentAt),
        ),
      );
    if (pending.length === 0) {
      return { ok: false, error: 'Нет неотправленных взносов' };
    }
    const total = round2(pending.reduce((s, m) => s + toNum(m.amount), 0));

    await db.transaction(async (tx) => {
      const [txn] = await tx
        .insert(transactions)
        .values({
          date: todayISO(),
          amount: String(total),
          kind: 'transfer',
          accountId: input.fromAccountId,
          counterAccountId: capAccount.id,
          // авто-платёж не должен вмешиваться в таблицы месяца/года
          hidden: true,
          note: `Платёж КАП (${pending.length} взн.)`,
        })
        .returning();
      for (const m of pending) {
        await tx
          .update(capMovements)
          .set({ transactionId: txn.id })
          .where(eq(capMovements.id, m.id));
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// -------------------------------------------------------- потратить цель

const spendInput = z.object({
  goalId: z.coerce.number().int().positive(),
  date: z.string(),
  mode: z.enum(['return', 'transfer']),
  toAccountId: z.coerce.number().int().positive().nullish(),
  targets: z
    .array(z.object({ goalId: z.coerce.number().int().positive(), amount: z.coerce.number().positive() }))
    .optional(),
});

export async function spendCapGoal(raw: z.input<typeof spendInput>): Promise<ActionResult> {
  try {
    const input = spendInput.parse(raw);
    const [goal] = await db.select().from(capGoals).where(eq(capGoals.id, input.goalId));
    if (!goal) return { ok: false, error: 'Цель не найдена' };

    const movements = await db
      .select()
      .from(capMovements)
      .where(eq(capMovements.capGoalId, input.goalId));
    const accumulated = round2(movements.reduce((s, m) => s + toNum(m.amount), 0));
    // у потраченной цели может остаться положительный остаток (например,
    // вернувшийся излишек перераспределения) — его можно перенести или вернуть
    if (accumulated <= 0) {
      return { ok: false, error: goal.spentAt ? 'Цель уже потрачена' : 'По цели ничего не накоплено' };
    }

    if (input.mode === 'return') {
      if (!input.toAccountId) return { ok: false, error: 'Выберите счёт возврата' };
      const capAccount = await ksOrCapAccount('savings_cap');
      if (!capAccount) return { ok: false, error: 'Счёт КАП не найден' };
      await db.transaction(async (tx) => {
        const [txn] = await tx
          .insert(transactions)
          .values({
            date: input.date,
            amount: String(accumulated),
            kind: 'transfer',
            accountId: capAccount.id,
            counterAccountId: input.toAccountId!,
            note: `Возврат КАП: ${goal.name}`,
          })
          .returning();
        await tx.insert(capMovements).values({
          capGoalId: goal.id,
          date: input.date,
          amount: String(-accumulated),
          source: 'spend',
          transactionId: txn.id,
          note: 'Возврат на счёт',
        });
        await tx.update(capGoals).set({ spentAt: input.date }).where(eq(capGoals.id, goal.id));
      });
    } else {
      const targets = input.targets ?? [];
      const sum = round2(targets.reduce((s, t) => s + t.amount, 0));
      if (targets.length === 0 || Math.abs(sum - accumulated) > 0.01) {
        return {
          ok: false,
          error: `Распределите ровно накопленную сумму (${accumulated.toFixed(2)} ₽)`,
        };
      }
      // предупреждение о переливе: цель не должна получить больше, чем ей
      // нужно для закрытия месяцев по текущий включительно
      const currentYm = ymOf(todayISO());
      for (const t of targets) {
        const [tg] = await db.select().from(capGoals).where(eq(capGoals.id, t.goalId));
        if (!tg) return { ok: false, error: 'Цель-получатель не найдена' };
        const tMoves = await db
          .select()
          .from(capMovements)
          .where(eq(capMovements.capGoalId, t.goalId));
        const tContributed = round2(tMoves.reduce((s, m) => s + toNum(m.amount), 0));
        const own = tMoves
          .filter((m) => m.source === 'own_funds')
          .map((m) => ymOf(String(m.date)))
          .sort();
        let startYm = own[0] ?? currentYm;
        if (tg.assetId) {
          const [asset] = await db
            .select({ purchaseDate: schema.assets.purchaseDate })
            .from(schema.assets)
            .where(eq(schema.assets.id, tg.assetId));
          if (asset?.purchaseDate) startYm = ymOf(String(asset.purchaseDate));
        }
        const monthsDue = Math.min(monthsBetweenInclusive(startYm, currentYm), tg.termMonths);
        const needToDate = round2(
          Math.min(monthsDue * toNum(tg.monthlyContribution), toNum(tg.targetAmount)),
        );
        const room = round2(needToDate - tContributed);
        if (t.amount > room + 1) {
          return {
            ok: false,
            error: `В «${tg.name}» уходит ${fmtMoney(t.amount)}, а для закрытия месяцев по текущий ей нужно только ${fmtMoney(Math.max(room, 0))}. Уменьшите сумму или распределите остаток в другие цели.`,
          };
        }
      }
      const group = randomUUID();
      await db.transaction(async (tx) => {
        for (const t of targets) {
          await tx.insert(capMovements).values({
            capGoalId: goal.id,
            date: input.date,
            amount: String(-round2(t.amount)),
            source: 'to_cap',
            counterpartCapId: t.goalId,
            transferGroup: group,
          });
          await tx.insert(capMovements).values({
            capGoalId: t.goalId,
            date: input.date,
            amount: String(round2(t.amount)),
            source: 'from_cap',
            counterpartCapId: goal.id,
            transferGroup: group,
          });
        }
        await tx.update(capGoals).set({ spentAt: input.date }).where(eq(capGoals.id, goal.id));
      });
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// Ручная корректировка (источник recalc) — для миграции и правок
const recalcInput = z.object({
  goalId: z.coerce.number().int().positive(),
  date: z.string(),
  amount: z.coerce.number(),
  note: z.string().max(300).optional(),
});

export async function addCapRecalc(raw: z.input<typeof recalcInput>): Promise<ActionResult> {
  try {
    const input = recalcInput.parse(raw);
    if (!input.amount) return { ok: false, error: 'Сумма не может быть нулевой' };
    await db.insert(capMovements).values({
      capGoalId: input.goalId,
      date: input.date,
      amount: String(round2(input.amount)),
      source: 'recalc',
      note: input.note || 'Корректировка',
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- отключение КАП у покупки

/** «Не применимо»: амортизация нужна, КАП — нет. Цель удаляется, если на ней нет накоплений. */
/** Отключение КАП у покупки (амортизация продолжается). Накопленное — включая
    отправленные взносы — перетекает в другие цели механизмом перетоков. */
export async function removeCapGoalForAsset(assetId: number): Promise<ActionResult> {
  try {
    const [goal] = await db.select().from(capGoals).where(eq(capGoals.assetId, assetId)).limit(1);
    if (!goal) return { ok: false, error: 'У покупки нет цели КАП' };
    const movements = await db
      .select()
      .from(capMovements)
      .where(eq(capMovements.capGoalId, goal.id));
    const accumulated = round2(movements.reduce((s, m) => s + toNum(m.amount), 0));
    const today = todayISO();
    let plan: { goalId: number; name: string; amount: number }[] = [];
    if (accumulated > 0.005) {
      const overview = await getCapOverview();
      plan = buildRedistributionPlan(overview.goals, goal.id, accumulated, ymOf(today));
      const planned = round2(plan.reduce((s, p) => s + p.amount, 0));
      if (planned < accumulated - 0.005) {
        return {
          ok: false,
          error: `В других целях свободно только ${fmtMoney(planned)} из накопленных ${fmtMoney(accumulated)} — сначала верните излишек на счёт (цель → «Потрачена» → вернуть на счёт)`,
        };
      }
    } else if (accumulated < -0.005) {
      return {
        ok: false,
        error: `По цели отрицательный остаток ${fmtMoney(accumulated)} — поправьте корректировкой перед удалением`,
      };
    }
    await db.transaction(async (tx) => {
      if (plan.length > 0) {
        const group = randomUUID();
        for (const p of plan) {
          await tx.insert(capMovements).values({
            capGoalId: goal.id,
            date: today,
            amount: String(-p.amount),
            source: 'to_cap',
            counterpartCapId: p.goalId,
            transferGroup: group,
          });
          await tx.insert(capMovements).values({
            capGoalId: p.goalId,
            date: today,
            amount: String(p.amount),
            source: 'from_cap',
            counterpartCapId: goal.id,
            transferGroup: group,
            note: `из удалённой «${goal.name}»`,
          });
        }
      }
      await tx.delete(capGoals).where(eq(capGoals.id, goal.id));
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
