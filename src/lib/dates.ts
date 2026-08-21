const TZ = process.env.APP_TZ || 'Europe/Moscow';

/** Сегодняшняя дата (YYYY-MM-DD) в часовом поясе пользователя. */
export function todayISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const ymOf = (iso: string) => iso.slice(0, 7);
export const yearOf = (iso: string) => Number(iso.slice(0, 4));

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/** Первый день месяца ym=YYYY-MM. */
export const monthStart = (ym: string) => `${ym}-01`;
/** Последний день месяца ym=YYYY-MM. */
export function monthEnd(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
}

/** ym + n месяцев. */
export function ymAdd(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/**
 * Дата n-го начисления: день покупки, с прижатием 29–31-х чисел
 * к последнему дню короткого месяца.
 */
export function addMonthsClamped(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const day = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const RU_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];
export const RU_MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
export const RU_MONTH_SHORT = ['Я', 'Ф', 'М', 'А', 'М', 'И', 'И', 'А', 'С', 'О', 'Н', 'Д'];

/** «август 2026» из YYYY-MM. */
export function ymTitle(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${RU_MONTHS[m - 1]} ${y}`;
}

/** «21 августа» из YYYY-MM-DD. */
export function dateTitle(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${RU_MONTHS_GEN[m - 1]}`;
}

/** «четверг, 21 августа 2026» */
export function dateTitleFull(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const weekday = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)));
  const cap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${cap}, ${d} ${RU_MONTHS_GEN[m - 1]} ${y}`;
}

/** «21.08.2026» */
export function dateShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isValidYM(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.slice(5, 7));
  return m >= 1 && m <= 12;
}

/** Количество месяцев между YYYY-MM (включительно): monthsBetween('2026-01','2026-03') = 3 */
export function monthsBetweenInclusive(fromYm: string, toYm: string): number {
  const [fy, fm] = fromYm.split('-').map(Number);
  const [ty, tm] = toYm.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}
