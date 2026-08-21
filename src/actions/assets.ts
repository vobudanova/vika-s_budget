'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import { buildSchedule, capTarget } from '@/lib/amortization';
import { parseAmountExpr, round2, toNum } from '@/lib/money';
import { isValidISODate } from '@/lib/dates';

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

    // категория «Покупки → <категория актива>» для фактического метода
    const [purchGroup] = await db
      .select()
      .from(categoryGroups)
      .where(eq(categoryGroups.name, 'Покупки'));
    const [purchCategory] = purchGroup
      ? await db
          .select()
          .from(categories)
          .where(and(eq(categories.groupId, purchGroup.id), eq(categories.name, assetCat.name)))
      : [];

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

// ----------------------------------------------------------- правка актива

const updateAssetInput = z.object({
  id: z.coerce.number().int().positive(),
  name: z.string().trim().min(1).optional(),
  date: dateSchema.optional(),
  price: amountSchema.optional(),
  termMonths: z.coerce.number().int().min(1).max(120).optional(),
  note: z.string().trim().max(500).nullish(),
});

export async function updateAsset(raw: z.input<typeof updateAssetInput>): Promise<ActionResult> {
  try {
    const input = updateAssetInput.parse(raw);
    await db.transaction(async (tx) => {
      await tx
        .update(assets)
        .set({
          ...(input.name ? { name: input.name } : {}),
          ...(input.date ? { purchaseDate: input.date } : {}),
          ...(input.price !== undefined ? { initialPrice: String(input.price) } : {}),
          ...(input.termMonths !== undefined ? { termMonths: input.termMonths } : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
        })
        .where(eq(assets.id, input.id));
      const price = await regenerateAccruals(tx, input.id);

      // цель КАП следует за параметрами (как в Excel), если ещё не потрачена
      const [goal] = await tx.select().from(capGoals).where(eq(capGoals.assetId, input.id));
      const [asset] = await tx.select().from(assets).where(eq(assets.id, input.id));
      if (goal && !goal.spentAt && asset) {
        const { target, monthly } = capTarget(price, asset.termMonths, Number(goal.inflationRate));
        await tx
          .update(capGoals)
          .set({
            targetAmount: String(target),
            monthlyContribution: String(monthly),
            termMonths: asset.termMonths,
            name: asset.name,
          })
          .where(eq(capGoals.id, goal.id));
      }

      // синхронизируем сумму транзакции-покупки с ценой
      if (input.price !== undefined || input.date || input.name) {
        await tx
          .update(transactions)
          .set({
            ...(input.price !== undefined ? { amount: String(input.price) } : {}),
            ...(input.date ? { date: input.date } : {}),
            ...(input.name ? { note: input.name } : {}),
          })
          .where(and(eq(transactions.assetId, input.id), eq(transactions.kind, 'purchase')));
      }
    });
    revalidateAll();
    return { ok: true };
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
      const [goal] = await tx.select().from(capGoals).where(eq(capGoals.assetId, input.assetId));
      const [asset] = await tx.select().from(assets).where(eq(assets.id, input.assetId));
      if (goal && !goal.spentAt && asset) {
        const { target, monthly } = capTarget(price, asset.termMonths, Number(goal.inflationRate));
        await tx
          .update(capGoals)
          .set({ targetAmount: String(target), monthlyContribution: String(monthly) })
          .where(eq(capGoals.id, goal.id));
      }
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
      await tx.update(assets).set({ disposedAt: input.date }).where(eq(assets.id, input.assetId));
      await regenerateAccruals(tx, input.assetId);
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
      await tx.update(assets).set({ disposedAt: null }).where(eq(assets.id, assetId));
      await regenerateAccruals(tx, assetId);
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAsset(assetId: number): Promise<ActionResult> {
  try {
    const [goal] = await db.select().from(capGoals).where(eq(capGoals.assetId, assetId));
    if (goal) {
      const movements = await db
        .select({ id: schema.capMovements.id })
        .from(schema.capMovements)
        .where(eq(schema.capMovements.capGoalId, goal.id))
        .limit(1);
      if (movements.length > 0) {
        return { ok: false, error: 'По КАП этой покупки уже есть взносы — сначала распределите их' };
      }
    }
    await db.transaction(async (tx) => {
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
