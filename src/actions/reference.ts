'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
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
