const NBSP = ' ';

/** «12 345,67» — всегда две копейки, разряды через неразрывный пробел. */
export function fmtNumber(value: number | string, digits = 2): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return n
    .toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/\s/g, NBSP);
}

/** «12 345,67 ₽»; целые суммы — без копеек: «12 345 ₽». */
export function fmtMoney(value: number | string, currency: 'RUB' | 'USD' = 'RUB'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  const digits = Math.abs(n % 1) < 0.005 ? 0 : 2;
  const sign = currency === 'USD' ? '$' : '₽';
  return `${fmtNumber(n, digits)}${NBSP}${sign}`;
}

/** Знак «+» для положительных — для лент операций по счёту. */
export function fmtSigned(value: number | string, currency: 'RUB' | 'USD' = 'RUB'): string {
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return (n > 0 ? '+' : '') + fmtMoney(n, currency);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Парсит сумму или выражение: «2360», «2 360,50», «100+200-50», «2800*2+600».
 * Возвращает null, если распарсить нельзя.
 */
export function parseAmountExpr(input: string): number | null {
  const cleaned = input
    .replace(/ |\s/g, '')
    .replace(/,/g, '.')
    .replace(/₽|руб\.?/gi, '');
  if (!cleaned) return null;
  if (!/^[-+]?\d+(\.\d+)?([-+*]\d+(\.\d+)?)*$/.test(cleaned)) return null;
  try {
    // Безопасно: выражение уже проверено регуляркой (цифры и + - * .)
    const result = Function(`"use strict"; return (${cleaned});`)() as number;
    if (!Number.isFinite(result)) return null;
    return round2(result);
  } catch {
    return null;
  }
}

export const toNum = (v: string | number | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : Number(v);
