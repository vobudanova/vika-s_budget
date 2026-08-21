'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db';
import { todayISO } from '@/lib/dates';

const { categories, categoryGroups, fundCategories, incomeSources, accounts } = schema;

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

export async function listAllCategories() {
  const [groups, cats] = await Promise.all([
    db.select().from(categoryGroups).orderBy(categoryGroups.sortOrder),
    db.select().from(categories).orderBy(categories.sortOrder),
  ]);
  return { groups, cats };
}
