import { addMonthsClamped } from './dates';
import { round2 } from './money';

export type AccrualRow = { seqNo: number; accrualDate: string; amount: number };

/**
 * Детерминированный график амортизации.
 * Первое начисление — в день и месяц покупки; 29–31-е числа прижимаются
 * к последнему дню короткого месяца. Сумма начислений точно равна базе:
 * последнее начисление добирает остаток копеек.
 * При досрочном завершении (disposedAt) начисления после этой даты не создаются.
 */
export function buildSchedule(
  effectivePrice: number,
  purchaseDate: string,
  termMonths: number,
  disposedAt?: string | null,
): AccrualRow[] {
  if (effectivePrice <= 0 || termMonths < 1) return [];
  const per = round2(effectivePrice / termMonths);
  const rows: AccrualRow[] = [];
  for (let i = 0; i < termMonths; i++) {
    const accrualDate = addMonthsClamped(purchaseDate, i);
    const amount = i === termMonths - 1 ? round2(effectivePrice - per * (termMonths - 1)) : per;
    rows.push({ seqNo: i + 1, accrualDate, amount });
  }
  const cut = disposedAt ? rows.filter((r) => r.accrualDate <= disposedAt) : rows;
  return cut;
}

/** Целевая сумма КАП: M = P × i^(t/12). */
export function capTarget(effectivePrice: number, termMonths: number, inflationRate: number) {
  const target = round2(effectivePrice * Math.pow(inflationRate, termMonths / 12));
  const monthly = round2(target / termMonths);
  return { target, monthly };
}
