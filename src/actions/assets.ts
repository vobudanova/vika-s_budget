'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { randomUUID } from 'crypto';
import { buildSchedule, capTarget } from '@/lib/amortization';
import { fmtMoney, parseAmountExpr, round2, toNum } from '@/lib/money';
import { isValidISODate, monthsBetweenInclusive, todayISO, ymAdd, ymOf } from '@/lib/dates';
import { buildRedistributionPlan, getCapOverview } from '@/queries/cap';

const {
  assets,
  assetAdjustments,
  amortizationAccruals,
  assetCategories,
  capGoals,
  categories,
  categoryGroups,
  transactions,
  settings,
} = schema;

export type ActionResult = { ok: true; id?: number } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  const msg =
    e instanceof z.ZodError
      ? e.issues.map((i) => i.message).join('; ')
      : e instanceof Error
        ? e.message
        : 'Неизвестная ошибка';
  return { ok: false, error: msg };
}

const revalidateAll = () => revalidatePath('/', 'layout');

const dateSchema = z.string().refine(isValidISODate, 'Некорректная дата');
const amountSchema = z.string().transform((s, ctx) => {
  const n = parseAmountExpr(s);
  if (n === null || n <= 0) {
    ctx.addIssue({ code: 'custom', message: 'Некорректная сумма' });
    return z.NEVER;
  }
  return n;
});

async function getInflationRate(): Promise<number> {
  const [row] = await db.select().from(settings).where(eq(settings.key, 'cap_inflation_rate'));
  const v = row ? Number(row.value) : 1.1;
  return Number.isFinite(v) && v > 0 ? v : 1.1;
}

async function effectivePrice(assetId: number): Promise<number> {
  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
  if (!asset) throw new Error('Покупка не найдена');
  const adjustments = await db
    .select()
    .from(assetAdjustments)
    .where(eq(assetAdjustments.assetId, assetId));
  return round2(toNum(asset.initialPrice) + adjustments.reduce((s, a) => s + toNum(a.amount), 0));
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Пересчёт цели КАП после смены цены или срока: цель считается на новый срок,
    а оставшийся месячный взнос — от недобранной суммы и оставшихся месяцев
    (уже отмеченные флажки не переписываются, добор ложится на остаток срока). */
async function recalcCapGoal(tx: DbOrTx, assetId: number, price: number, termMonths: number) {
  const [goal] = await tx.select().from(capGoals).where(eq(capGoals.assetId, assetId));
  if (!goal || goal.spentAt) return;
  const target = round2(price * Math.pow(Number(goal.inflationRate), termMonths / 12));
  const movements = await tx
    .select({ amount: schema.capMovements.amount, source: schema.capMovements.source, date: schema.capMovements.date })
    .from(schema.capMovements)
    .where(eq(schema.capMovements.capGoalId, goal.id));
  const contributed = round2(movements.reduce((s, m) => s + toNum(m.amount), 0));
  const flaggedMonths = new Set(
    movements.filter((m) => m.source === 'own_funds').map((m) => ymOf(String(m.date))),
  ).size;
  const remaining = round2(target - contributed);
  const remMonths = Math.max(1, termMonths - flaggedMonths);
  const monthly =
    remaining > 0.005 ? round2(remaining / remMonths) : toNum(goal.monthlyContribution);
  await tx
    .update(capGoals)
    .set({ targetAmount: String(target), monthlyContribution: String(monthly), termMonths })
    .where(eq(capGoals.id, goal.id));
}

/** Полная перегенерация графика начислений (чистая функция от параметров актива). */
async function regenerateAccruals(tx: DbOrTx, assetId: number) {
  const [asset] = await tx.select().from(assets).where(eq(assets.id, assetId));
  if (!asset) throw new Error('Покупка не найдена');
  const adjustments = await tx
    .select()
    .from(assetAdjustments)
    .where(eq(assetAdjustments.assetId, assetId));
  const price = round2(toNum(asset.initialPrice) + adjustments.reduce((s, a) => s + toNum(a.amount), 0));
  await tx.delete(amortizationAccruals).where(eq(amortizationAccruals.assetId, assetId));
  const rows = buildSchedule(price, asset.purchaseDate, asset.termMonths, asset.disposedAt);
  if (rows.length > 0) {
    await tx.insert(amortizationAccruals).values(
      rows.map((r) => ({
        assetId,
        seqNo: r.seqNo,
        accrualDate: r.accrualDate,
        amount: String(r.amount),
      })),
    );
  }
  return price;
}

// ------------------------------------------------------------------ покупка

const purchaseInput = z.object({
  name: z.string().trim().min(1, 'Укажите название'),
  date: dateSchema,
  price: amountSchema,
  assetCategoryId: z.coerce.number().int().positive('Выберите категорию'),
  termMonths: z.coerce.number().int().min(1).max(120),
  accountId: z.coerce.number().int().positive().nullish(),
  withCap: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export async function createPurchase(raw: z.input<typeof purchaseInput>): Promise<ActionResult> {
  try {
    const input = purchaseInput.parse(raw);
    const [assetCat] = await db
      .select()
      .from(assetCategories)
      .where(eq(assetCategories.id, input.assetCategoryId));
    if (!assetCat) return { ok: false, error: 'Категория актива не найдена' };

    // категория «Покупки → <категория актива>» для фактического метода;
    // без неё покупка выпадала бы из «Фактических» — досоздаём при необходимости
    let [purchGroup] = await db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.name, 'Покупки'));
    if (!purchGroup) {
      [purchGroup] = await db
        .insert(categoryGroups)
        .values({ name: 'Покупки', sortOrder: 60 })
        .returning();
    }
    let [purchCategory] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.groupId, purchGroup.id), eq(categories.name, assetCat.name)));
    if (!purchCategory) {
      [purchCategory] = await db
        .insert(categories)
        .values({
          groupId: purchGroup.id,
          name: assetCat.name,
          sortOrder: 99,
          activeFrom: input.date,
        })
        .returning();
    }

    const rate = await getInflationRate();

    const assetId = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(assets)
        .values({
          name: input.name,
          assetCategoryId: input.assetCategoryId,
          purchaseDate: input.date,
          initialPrice: String(input.price),
          termMonths: input.termMonths,
          note: input.note || null,
        })
        .returning();

      await tx.insert(transactions).values({
        date: input.date,
        amount: String(input.price),
        kind: 'purchase',
        categoryId: purchCategory?.id,
        accountId: input.accountId ?? undefined,
        assetId: asset.id,
        note: input.name,
      });

      const rows = buildSchedule(input.price, input.date, input.termMonths);
      await tx.insert(amortizationAccruals).values(
        rows.map((r) => ({
          assetId: asset.id,
          seqNo: r.seqNo,
          accrualDate: r.accrualDate,
          amount: String(r.amount),
        })),
      );

      if (input.withCap) {
        const { target, monthly } = capTarget(input.price, input.termMonths, rate);
        await tx.insert(capGoals).values({
          assetId: asset.id,
          name: input.name,
          targetAmount: String(target),
          inflationRate: String(rate),
          termMonths: input.termMonths,
          monthlyContribution: String(monthly),
        });
      }
      return asset.id;
    });

    revalidateAll();
    return { ok: true, id: assetId };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------------- перепродажа

const resaleInput = z.object({
  assetId: z.coerce.number().int().positive(),
  date: dateSchema,
  amount: amountSchema,
  counterAccountId: z.coerce.number().int().positive('Куда пришли деньги'),
  note: z.string().trim().max(500).optional(),
});

export async function resaleAsset(raw: z.input<typeof resaleInput>): Promise<ActionResult> {
  try {
    const input = resaleInput.parse(raw);
    const current = await effectivePrice(input.assetId);
    if (input.amount >= current) {
      return { ok: false, error: 'Сумма перепродажи не меньше остаточной стоимости' };
    }
    await db.transaction(async (tx) => {
      await tx.insert(assetAdjustments).values({
        assetId: input.assetId,
        date: input.date,
        amount: String(-input.amount),
        reason: input.note || 'Перепродажа',
      });
      await tx.insert(transactions).values({
        date: input.date,
        amount: String(input.amount),
        kind: 'asset_resale',
        counterAccountId: input.counterAccountId,
        assetId: input.assetId,
        note: input.note || 'Перепродажа',
      });
      const price = await regenerateAccruals(tx, input.assetId);
      const [asset] = await tx.select().from(assets).where(eq(assets.id, input.assetId));
      if (asset) await recalcCapGoal(tx, input.assetId, price, asset.termMonths);
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- досрочное завершение

const disposeInput = z.object({
  assetId: z.coerce.number().int().positive(),
  date: dateSchema,
});

export async function disposeAsset(raw: z.input<typeof disposeInput>): Promise<ActionResult> {
  try {
    const input = disposeInput.parse(raw);
    await db.transaction(async (tx) => {
      const [asset] = await tx.select().from(assets).where(eq(assets.id, input.assetId));
      if (!asset) throw new Error('Покупка не найдена');
      await tx.update(assets).set({ disposedAt: input.date }).where(eq(assets.id, input.assetId));
      const price = await regenerateAccruals(tx, input.assetId);
      // вещь прожила меньше срока — цель КАП пересчитывается на фактический
      // срок службы, добор ложится на месяцы после уже отмеченных флажков
      const actualTerm = Math.max(
        1,
        Math.min(
          monthsBetweenInclusive(ymOf(String(asset.purchaseDate)), ymOf(input.date)),
          asset.termMonths,
        ),
      );
      await recalcCapGoal(tx, input.assetId, price, actualTerm);
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function undisposeAsset(assetId: number): Promise<ActionResult> {
  try {
    await db.transaction(async (tx) => {
      const [asset] = await tx.select().from(assets).where(eq(assets.id, assetId));
      if (!asset) throw new Error('Покупка не найдена');
      await tx.update(assets).set({ disposedAt: null }).where(eq(assets.id, assetId));
      const price = await regenerateAccruals(tx, assetId);
      // возврат в строй: цель снова считается на полный срок вещи
      await recalcCapGoal(tx, assetId, price, asset.termMonths);
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Удаление покупки вместе с целью КАП. Если по цели уже есть накопления
    (в т.ч. отправленные), они перетекают в другие цели механизмом перетоков —
    деньги остаются за фондом, флажки-получатели темнеют перераспределением. */
export async function deleteAsset(assetId: number): Promise<ActionResult> {
  try {
    const [goal] = await db.select().from(capGoals).where(eq(capGoals.assetId, assetId));
    const today = todayISO();
    let plan: { goalId: number; name: string; amount: number }[] = [];
    let goalName = '';
    if (goal) {
      goalName = goal.name;
      const movements = await db
        .select({ amount: schema.capMovements.amount })
        .from(schema.capMovements)
        .where(eq(schema.capMovements.capGoalId, goal.id));
      const accumulated = round2(movements.reduce((s, m) => s + toNum(m.amount), 0));
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
      }
    }
    await db.transaction(async (tx) => {
      if (goal && plan.length > 0) {
        const group = randomUUID();
        for (const p of plan) {
          await tx.insert(schema.capMovements).values({
            capGoalId: goal.id,
            date: today,
            amount: String(-p.amount),
            source: 'to_cap',
            counterpartCapId: p.goalId,
            transferGroup: group,
          });
          await tx.insert(schema.capMovements).values({
            capGoalId: p.goalId,
            date: today,
            amount: String(p.amount),
            source: 'from_cap',
            counterpartCapId: goal.id,
            transferGroup: group,
            note: `из удалённой «${goalName}»`,
          });
        }
      }
      await tx
        .delete(transactions)
        .where(and(eq(transactions.assetId, assetId), eq(transactions.kind, 'purchase')));
      if (goal) await tx.delete(capGoals).where(eq(capGoals.id, goal.id));
      await tx.delete(assets).where(eq(assets.id, assetId)); // каскадом удалит график и корректировки
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------- редактирование покупки

const editInput = z.object({
  assetId: z.coerce.number().int().positive(),
  name: z.string().trim().min(1, 'Укажите название'),
  date: dateSchema,
  price: amountSchema,
  assetCategoryId: z.coerce.number().int().positive('Выберите категорию'),
  termMonths: z.coerce.number().int().min(1).max(120),
});

/** Правка покупки: транзакция, график амортизации и цель КАП пересчитываются. */
export async function editAsset(raw: z.input<typeof editInput>): Promise<ActionResult> {
  try {
    const input = editInput.parse(raw);
    const [before] = await db.select().from(assets).where(eq(assets.id, input.assetId));
    if (!before) return { ok: false, error: 'Покупка не найдена' };
    // переименование не трогает взнос — цель пересчитывается только при
    // изменении цены, срока или даты покупки
    const capAffected =
      toNum(before.initialPrice) !== input.price ||
      before.termMonths !== input.termMonths ||
      String(before.purchaseDate) !== input.date;
    const [assetCat] = await db
      .select()
      .from(assetCategories)
      .where(eq(assetCategories.id, input.assetCategoryId));
    if (!assetCat) return { ok: false, error: 'Категория актива не найдена' };

    // категория «Покупки → <категория актива>» для фактического метода
    let [purchGroup] = await db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.name, 'Покупки'));
    if (!purchGroup) {
      [purchGroup] = await db
        .insert(categoryGroups)
        .values({ name: 'Покупки', sortOrder: 60 })
        .returning();
    }
    let [purchCategory] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.groupId, purchGroup.id), eq(categories.name, assetCat.name)));
    if (!purchCategory) {
      [purchCategory] = await db
        .insert(categories)
        .values({
          groupId: purchGroup.id,
          name: assetCat.name,
          sortOrder: 99,
          activeFrom: input.date,
        })
        .returning();
    }

    await db.transaction(async (tx) => {
      await tx
        .update(assets)
        .set({
          name: input.name,
          purchaseDate: input.date,
          initialPrice: String(input.price),
          termMonths: input.termMonths,
          assetCategoryId: input.assetCategoryId,
        })
        .where(eq(assets.id, input.assetId));

      await tx
        .update(transactions)
        .set({
          date: input.date,
          amount: String(input.price),
          note: input.name,
          categoryId: purchCategory.id,
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.assetId, input.assetId), eq(transactions.kind, 'purchase')));

      // график начислений и цель КАП пересчитываются от новых параметров
      const price = await regenerateAccruals(tx, input.assetId);
      const [goal] = await tx.select().from(capGoals).where(eq(capGoals.assetId, input.assetId));
      if (goal && !goal.spentAt) {
        await tx.update(capGoals).set({ name: input.name }).where(eq(capGoals.id, goal.id));
        if (capAffected) await recalcCapGoal(tx, input.assetId, price, input.termMonths);
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
