'use server';

import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';

const schema = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('day'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }),
  z.object({ scope: z.literal('month'), ym: z.string().regex(/^\d{4}-\d{2}$/) }),
  z.object({ scope: z.literal('year'), year: z.string().regex(/^\d{4}$/) }),
  z.object({ scope: z.literal('assets') }),
  z.object({ scope: z.literal('cap') }),
  z.object({ scope: z.literal('fund') }),
  z.object({ scope: z.literal('income') }),
  z.object({ scope: z.literal('balance') }),
]);

export type WipeScope = z.infer<typeof schema>;

/** «Удалить все данные» страницы. Необратимо: чистит операции раздела. */
export async function wipePageData(input: WipeScope): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Некорректный запрос' };
  const p = parsed.data;

  try {
    await db.transaction(async (tx) => {
      // период для day/month/year: [from, to)
      if (p.scope === 'day' || p.scope === 'month' || p.scope === 'year') {
        const from =
          p.scope === 'day' ? p.date : p.scope === 'month' ? `${p.ym}-01` : `${p.year}-01-01`;
        const to =
          p.scope === 'day'
            ? sql`(${from}::date + 1)`
            : p.scope === 'month'
              ? sql`(${from}::date + interval '1 month')`
              : sql`(${from}::date + interval '1 year')`;

        // покупки периода: цели КАП (их движения — каскадом) и активы (графики — каскадом)
        await tx.execute(sql`
          DELETE FROM cap_goals WHERE asset_id IN
            (SELECT id FROM assets WHERE purchase_date >= ${from}::date AND purchase_date < ${to})
        `);
        await tx.execute(sql`
          DELETE FROM assets WHERE purchase_date >= ${from}::date AND purchase_date < ${to}
        `);
        // отвязать отправленные платежи КАП и удалить движения фонда, созданные операциями периода
        await tx.execute(sql`
          UPDATE cap_movements SET transaction_id = NULL WHERE transaction_id IN
            (SELECT id FROM transactions WHERE date >= ${from}::date AND date < ${to})
        `);
        await tx.execute(sql`
          DELETE FROM fund_movements WHERE transaction_id IN
            (SELECT id FROM transactions WHERE date >= ${from}::date AND date < ${to})
        `);
        await tx.execute(sql`
          DELETE FROM transactions WHERE date >= ${from}::date AND date < ${to}
        `);
        await tx.execute(sql`
          DELETE FROM filled_days WHERE date >= ${from}::date AND date < ${to}
        `);
      }

      if (p.scope === 'assets') {
        await tx.execute(sql`DELETE FROM cap_goals WHERE asset_id IS NOT NULL`);
        await tx.execute(sql`DELETE FROM assets`);
        await tx.execute(sql`DELETE FROM transactions WHERE kind IN ('purchase', 'asset_resale')`);
      }

      if (p.scope === 'cap') {
        await tx.execute(sql`
          DELETE FROM transactions WHERE id IN
            (SELECT transaction_id FROM cap_movements WHERE transaction_id IS NOT NULL)
        `);
        await tx.execute(sql`DELETE FROM cap_movements`);
        await tx.execute(sql`DELETE FROM cap_goals`);
      }

      if (p.scope === 'fund') {
        await tx.execute(sql`
          DELETE FROM transactions WHERE kind = 'reimbursement' OR id IN
            (SELECT transaction_id FROM fund_movements WHERE transaction_id IS NOT NULL)
        `);
        await tx.execute(sql`DELETE FROM fund_movements`);
      }

      if (p.scope === 'income') {
        await tx.execute(sql`DELETE FROM transactions WHERE kind = 'income'`);
      }

      if (p.scope === 'balance') {
        await tx.execute(sql`DELETE FROM account_snapshots`);
        await tx.execute(sql`DELETE FROM obligations`);
      }
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Не удалось удалить данные' };
  }

  revalidatePath('/', 'layout');
  return { ok: true };
}
