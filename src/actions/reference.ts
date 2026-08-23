'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { todayISO } from '@/lib/dates';

const { categories, categoryGroups, fundCategories, incomeSources, accounts, assetCategories } = schema;

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

export async function createCategory(groupId: number, name: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    await db.insert(categories).values({
      groupId,
      name: clean,
      sortOrder: 99,
      activeFrom: todayISO().slice(0, 8) + '01',
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function renameCategory(id: number, name: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    // Переименование глобально: все прошлые и будущие записи ссылаются на id
    await db.update(categories).set({ name: clean }).where(eq(categories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type CategoryUsage = { ym: string; total: number; count: number };

/** Где по категории есть данные — для предупреждения перед удалением. */
export async function getCategoryUsage(id: number): Promise<CategoryUsage[]> {
  const res = await db.execute(sql`
    SELECT to_char(date, 'YYYY-MM') AS ym, sum(amount) AS total, count(*) AS count
    FROM transactions WHERE category_id = ${id}
    GROUP BY 1 ORDER BY 1
  `);
  return (res.rows as Array<{ ym: string; total: string; count: string }>).map((r) => ({
    ym: r.ym,
    total: Number(r.total),
    count: Number(r.count),
  }));
}

/** Пометить к удалению (предупреждение висит, пока есть данные) / снять пометку. */
export async function setCategoryPendingDelete(id: number, pending: boolean): Promise<ActionResult> {
  try {
    await db.update(categories).set({ pendingDelete: pending }).where(eq(categories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Окончательное удаление — только когда данных не осталось. */
export async function deleteCategoryHard(id: number): Promise<ActionResult> {
  try {
    const usage = await getCategoryUsage(id);
    if (usage.length > 0) {
      return {
        ok: false,
        error: `По категории ещё есть записи (${usage.map((u) => u.ym).join(', ')}) — сначала перенесите их`,
      };
    }
    await db.delete(categories).where(eq(categories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveCategory(id: number): Promise<ActionResult> {
  try {
    await db.update(categories).set({ activeTo: todayISO() }).where(eq(categories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function unarchiveCategory(id: number): Promise<ActionResult> {
  try {
    await db.update(categories).set({ activeTo: null }).where(eq(categories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createFundCategory(
  groupName: string,
  name: string,
  monthlyPlan: number,
): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    await db.insert(fundCategories).values({
      name: clean,
      groupName: groupName.trim() || 'Прочее',
      monthlyPlan: String(Math.max(0, monthlyPlan)),
      sortOrder: 99,
      activeFrom: todayISO().slice(0, 8) + '01',
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateFundPlan(id: number, monthlyPlan: number): Promise<ActionResult> {
  try {
    await db
      .update(fundCategories)
      .set({ monthlyPlan: String(Math.max(0, monthlyPlan)) })
      .where(eq(fundCategories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateFundOpening(id: number, opening: number): Promise<ActionResult> {
  try {
    await db
      .update(fundCategories)
      .set({ openingBalance: String(opening) })
      .where(eq(fundCategories.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateIncomeExpected(id: number, expected: number | null): Promise<ActionResult> {
  try {
    await db
      .update(incomeSources)
      .set({ expectedMonthly: expected === null ? null : String(Math.max(0, expected)) })
      .where(eq(incomeSources.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createIncomeSource(name: string, type: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    await db.insert(incomeSources).values({ name: clean, type, sortOrder: 99 });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function createAccount(name: string, type: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    await db.insert(accounts).values({ name: clean, type, sortOrder: 40 });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleAccountActive(id: number, active: boolean): Promise<ActionResult> {
  try {
    await db.update(accounts).set({ isActive: active }).where(eq(accounts.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function renameAccount(id: number, name: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    await db.update(accounts).set({ name: clean }).where(eq(accounts.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAccount(id: number): Promise<ActionResult> {
  try {
    const used = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM transactions WHERE account_id = ${id} OR counter_account_id = ${id}) AS tx,
        (SELECT count(*) FROM account_snapshots WHERE account_id = ${id}) AS snaps
    `);
    const row = (used.rows as any[])[0];
    const tx = Number(row?.tx ?? 0);
    const snaps = Number(row?.snaps ?? 0);
    if (tx > 0 || snaps > 0) {
      return {
        ok: false,
        error: `Счёт используется: операций — ${tx}, снапшотов — ${snaps}. Перенесите или удалите их, либо скройте счёт.`,
      };
    }
    await db.delete(accounts).where(eq(accounts.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function listAllCategories() {
  const [groups, cats] = await Promise.all([
    db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder),
    db.select().from(categories).orderBy(categories.sortOrder),
  ]);
  return { groups, cats };
}

/** Справочники для шторки редактирования операции: категории и активные счета. */
export async function listEditRefs() {
  const [cats, accs] = await Promise.all([
    db.execute(sql`
      SELECT c.id, c.name, g.name AS group_name
      FROM categories c JOIN category_groups g ON g.id = c.group_id
      WHERE c.row_type = 'expense' AND c.active_to IS NULL AND NOT c.pending_delete
      ORDER BY g.sort_order, c.sort_order, c.name
    `),
    db.execute(sql`
      SELECT id, name FROM accounts WHERE is_active ORDER BY sort_order, name
    `),
  ]);
  return {
    categories: (cats.rows as any[]).map((c) => ({
      id: Number(c.id),
      name: c.name as string,
      groupName: c.group_name as string,
    })),
    accounts: (accs.rows as any[]).map((a) => ({ id: Number(a.id), name: a.name as string })),
  };
}

export async function renameIncomeSource(id: number, name: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    await db.update(incomeSources).set({ name: clean }).where(eq(incomeSources.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteIncomeSource(id: number): Promise<ActionResult> {
  try {
    const used = await db.execute(sql`
      SELECT count(*) AS tx FROM transactions WHERE income_source_id = ${id}
    `);
    const tx = Number((used.rows as any[])[0]?.tx ?? 0);
    if (tx > 0) {
      return {
        ok: false,
        error: `По источнику есть поступления — ${tx} шт. Перенесите или удалите их сначала.`,
      };
    }
    await db.delete(incomeSources).where(eq(incomeSources.id, id));
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ------------------------------------------------------- категории вещей

/** Переименовать категорию вещей; связанная категория «Покупки → …»
    переименовывается вместе с ней. */
export async function renameAssetCategory(id: number, name: string): Promise<ActionResult> {
  try {
    const clean = name.trim();
    if (!clean) return { ok: false, error: 'Пустое название' };
    const [cat] = await db.select().from(assetCategories).where(eq(assetCategories.id, id));
    if (!cat) return { ok: false, error: 'Категория не найдена' };
    await db.transaction(async (tx) => {
      await tx.update(assetCategories).set({ name: clean }).where(eq(assetCategories.id, id));
      const [purchGroup] = await tx.select().from(categoryGroups).where(eq(categoryGroups.name, 'Покупки'));
      if (purchGroup) {
        await tx
          .update(categories)
          .set({ name: clean })
          .where(and(eq(categories.groupId, purchGroup.id), eq(categories.name, cat.name)));
      }
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Сдвинуть категорию вещей вверх/вниз (обмен sort_order с соседом). */
export async function moveAssetCategory(id: number, dir: -1 | 1): Promise<ActionResult> {
  try {
    const all = await db.select().from(assetCategories).orderBy(asc(assetCategories.sortOrder));
    const idx = all.findIndex((c) => c.id === id);
    if (idx < 0) return { ok: false, error: 'Категория не найдена' };
    const swap = all[idx + dir];
    if (!swap) return { ok: true };
    const a = all[idx];
    await db.transaction(async (tx) => {
      await tx.update(assetCategories).set({ sortOrder: swap.sortOrder }).where(eq(assetCategories.id, a.id));
      await tx.update(assetCategories).set({ sortOrder: a.sortOrder }).where(eq(assetCategories.id, swap.id));
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
