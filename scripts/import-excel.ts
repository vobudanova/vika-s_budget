/**
 * Импорт исторических данных из Excel-файлов («Бюджет-эксель») в БД.
 *
 * Запуск: npm run import:excel
 * Документация: docs/IMPORT.md
 *
 * Скрипт идемпотентен: операционные таблицы очищаются (TRUNCATE ... RESTART IDENTITY),
 * справочники не трогаются (кроме UPDATE статей КС и создания служебных
 * «(импорт) …» статей/счетов через ON CONFLICT DO NOTHING).
 */
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/db/schema';
import { round2 } from '../src/lib/money';
import { buildSchedule } from '../src/lib/amortization';
import { addMonthsClamped, daysInMonth, todayISO } from '../src/lib/dates';

const SRC_DIR = '/Users/olegkozyrev/Downloads/Бюджет-эксель';
const MONTH_FILES: Array<{ file: string; ym: string }> = [
  { file: 'Months/0.1.1_March_26_B.xlsx', ym: '2026-03' },
  { file: 'Months/0.1.1_April_26_B.xlsx', ym: '2026-04' },
  { file: 'Months/0.2.0_May_26_B.xlsx', ym: '2026-05' },
  { file: 'Months/0.2.0_June_26_B.xlsx', ym: '2026-06' },
  { file: 'Months/0.2.0_July_26_B.xlsx', ym: '2026-07' },
  { file: 'Months/0.2.0_August_26_B.xlsx', ym: '2026-08' },
];
const AMORT_FILE = 'Amortization/0.2.0_Amortization_26_B.xlsx';
const INCOME_FILE = '0.1.0_Income_26_B.xlsx';
const STS_FILE = '0.1.0_STS_26_B.xlsx';
const CONSOLIDATED_FILE = '0.1.0_consolidated_budget_26_B.xlsx';

const CAP_MOVE_DATE = '2026-04-01';
const CAP_INFLATION = '1.1';

// ---------------------------------------------------------------- маппинги

/** Строки листа «Месяц» → категория БД («Группа/Название»). */
const EXPENSE_ROW_MAP: Record<string, Record<string, string>> = {
  'Питание': {
    'Продукты': 'Питание/Продукты',
    'Кафе, рестораны, доставка': 'Питание/Кафе, рестораны, доставка',
  },
  'Красота': {
    'Маникюр и педикюр': 'Красота/Маникюр и педикюр',
    'Процедуры для волос': 'Красота/Процедуры для волос',
    'Спорт': 'Красота/Спорт',
    'Массаж, лазер, косметолог': 'Красота/Массаж, лазер, косметолог',
    'Уходовая косметика (лицо и тело)': 'Красота/Уходовая косметика',
    'Косметика для волос': 'Красота/Косметика для волос',
    'Гигиена, аксессуары, декоративка': 'Красота/Гигиена, аксессуары, декоративка',
  },
  'Транспортные расходы': {
    'Общественный транспорт, самокат': 'Транспорт/Общественный транспорт, самокат',
    'Такси': 'Транспорт/Такси',
  },
  'Бабушки': {
    'Ежемес. деньги': 'Бабушки/Ежемесячные деньги',
    'Ежемесячные деньги': 'Бабушки/Ежемесячные деньги',
    'Цветы, подарки, другое': 'Бабушки/Цветы, подарки, другое',
  },
  'Прочее': {
    'Подписки, интернет, моб. связь': 'Прочее/Подписки, интернет, связь',
    'Домашний кальян': 'Прочее/Домашний кальян',
    'Благотворительность': 'Прочее/Благотворительность',
    'Химчистка и ремонт одежды': 'Прочее/Химчистка',
    'Всё для дома и уборки': 'Прочее/Всё для дома',
    'Лечение': 'Прочее/Лечение',
    'Писюха': 'Прочее/Писюха',
    'Писюха (кот)': 'Прочее/Писюха',
    'Эл. книги и канц. товары': 'Прочее/Эл. книги и канцтовары',
    'Эл. книги и канц.': 'Прочее/Эл. книги и канцтовары',
    'Совсем прочее (+КУ)': 'Прочее/Совсем прочее (+КУ)',
    'Совсем прочее': 'Прочее/Совсем прочее (+КУ)',
  },
  'Поездки и путешествия': {
    'Билеты': 'Поездки/Билеты',
    'Котоняня': 'Поездки/Котоняня',
    'Жилье': 'Поездки/Жильё',
    'Жильё': 'Поездки/Жильё',
    'Питание': 'Поездки/Питание в поездке',
    'Проезд': 'Поездки/Проезд',
    'Кальяны': 'Поездки/Кальяны',
    'Другое': 'Поездки/Другое',
  },
};

const PURCHASE_ROWS = new Set(['Одежда', 'Красота и здоровье', 'Техника', 'Прочее', 'Книги']);
const AMORT_ROWS = PURCHASE_ROWS; // тот же набор — блок «Амортизация» не импортируем

/** «Сбережения»: строка → счёт-получатель. */
const SAVING_MAP: Record<string, string> = {
  'Драг. металлы': 'Драгоценные металлы',
  'Фондовый рынок': 'Фондовый рынок',
  'Наличные доллары': 'Доллары (по цене покупки)',
  'Наличные рубли': 'Наличные ₽',
  'Долгосрочный вклад': 'Долгосрочный вклад Т-Банк',
};

/** «Компенсировано из КС»: строка → служебная статья фонда. */
const COMP_MAP: Record<string, string> = {
  'Волосы': '(импорт) Волосы',
  'Косметология и лазер': '(импорт) Косметология и лазер',
  'Бабушки': '(импорт) Бабушки',
  'Х/ч и ремонт одежды': '(импорт) Х/ч и ремонт',
  'Прочее': '(импорт) Прочее',
};

/** Служебные статьи фонда: имя → группа. */
const SERVICE_FUND_CATS: Array<{ name: string; groupName: string; sortOrder: number }> = [
  { name: '(импорт) Волосы', groupName: 'Красота', sortOrder: 101 },
  { name: '(импорт) Косметология и лазер', groupName: 'Красота', sortOrder: 102 },
  { name: '(импорт) Бабушки', groupName: 'Бабушки', sortOrder: 103 },
  { name: '(импорт) Х/ч и ремонт', groupName: 'Прочее', sortOrder: 104 },
  { name: '(импорт) Прочее', groupName: 'Прочее', sortOrder: 105 },
];

/** Лист «Баланс», колонки B..K → счёт (шапка сверяется с ожидаемой). */
const BALANCE_COLS: Array<{ col: number; hdr1: string; hdr2: string; account: string }> = [
  { col: 2, hdr1: 'карточки', hdr2: 'Т-Банк (деб. счет)', account: 'Т-Банк дебетовая' },
  { col: 3, hdr1: 'карточки', hdr2: 'Т-Банк (кредитка)', account: 'Т-Банк кредитка' },
  { col: 4, hdr1: 'накопительные счета', hdr2: 'КАП', account: 'НС КАП' },
  { col: 5, hdr1: 'накопительные счета', hdr2: 'КС', account: 'НС КС' },
  { col: 6, hdr1: 'временные вклады', hdr2: 'Т-Банк', account: 'Временный вклад (импорт)' },
  { col: 7, hdr1: 'наличные', hdr2: '₽', account: 'Наличные ₽' },
  { col: 8, hdr1: 'наличные', hdr2: '$', account: 'Наличные $' },
  { col: 9, hdr1: 'Драг. металлы', hdr2: '₽', account: 'Драгоценные металлы' },
  { col: 10, hdr1: 'долгосрочные вклады', hdr2: 'Т-Банк', account: 'Долгосрочный вклад Т-Банк' },
  { col: 11, hdr1: 'долгосрочные вклады', hdr2: 'ВТБ', account: 'Долгосрочный вклад ВТБ' },
];

/** Блоки «Амортизация 2026» → категория активов. */
const AMORT_BLOCKS: Record<string, string> = {
  'Одежда': 'Одежда',
  'Красота и здоровье': 'Красота и здоровье',
  'Техника': 'Техника',
  'Прочее': 'Прочее',
  'Книги, блокноты, канцтовары': 'Книги',
  'завершено': '__done__',
};

/** Лист «Доходы»: строка → источник дохода БД (+ счёт-получатель). */
const INCOME_MAP: Array<{ row: string; source: string; account?: string }> = [
  { row: 'Большевик (квартира)', source: 'Большевик (квартира)' },
  { row: 'Большевик (кладовка)', source: 'Большевик (кладовка)' },
  { row: 'М/м 1', source: 'Машиноместо 1' },
  { row: 'М/м 2', source: 'Машиноместо 2' },
  { row: 'Возврат долга за ВиВи', source: 'Возврат долга' },
  { row: 'Продажи (Авито и др.)', source: 'Продажи (Авито и др.)' },
  { row: 'ВТБ', source: 'Проценты по вкладам' },
  { row: 'Т-Банк % по вкладам', source: 'Проценты по вкладам' },
  { row: 'Т-Банк кэшбек (деб.)', source: 'Кэшбек' },
  { row: 'Т-Банк кэшбек (кредитка)', source: 'Кэшбек' },
  { row: 'НС: ДС', source: 'Проценты по НС' },
  { row: 'НС: КС', source: 'Проценты по НС' },
  { row: 'НС: КАП', source: 'Проценты по НС' },
  { row: 'Другие НС', source: 'Проценты по НС' },
  { row: 'Прочее', source: 'Прочее' },
  { row: 'Ежемесячный платеж', source: 'Ежемесячный платёж' },
  { row: 'Компенсации', source: 'Компенсации' },
  { row: 'Доходы наличными', source: 'Доходы наличными', account: 'Наличные ₽' },
];

/** Лист «КС»: строка → статья фонда БД. */
const STS_MAP: Record<string, string> = {
  'Лазер': 'Лазер',
  'Волосы (процедуры)': 'Волосы (процедуры)',
  'Косметология': 'Косметология',
  'Косметика': 'Косметика',
  'санаторий Аня': 'Санаторий Аня',
  'Новый год': 'Новый год',
  '8 марта': '8 марта',
  'д/р Аня': 'День рождения Аня',
  'д/р Зина': 'День рождения Зина',
  'встречи': 'Встречи',
  'Лечение': 'Лечение',
  'Налоги': 'Налоги',
  'Химчистка': 'Химчистка',
  'Большевик': 'Большевик',
  'Фильтр для воды': 'Фильтр для воды',
  'Ремонт Loftec': 'Ремонт Loftec',
  'На др': 'На дни рождения',
  'ВПН': 'ВПН',
  'Лорашка': 'Лорашка',
  'Путешествия по России': 'Путешествия по России',
};
const STS_GROUP_ROWS = new Set(['КС', 'итого:', 'Красота', 'Бабушки', 'Прочее']);

// ---------------------------------------------------------------- утилиты

function fail(msg: string): never {
  throw new Error(`ИМПОРТ ОСТАНОВЛЕН: ${msg}`);
}

/** Текст ячейки (rich text, формулы → результат). */
function textOf(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as any;
    if (o.richText) return o.richText.map((r: any) => r.text ?? '').join('');
    if ('result' in o) return textOf(o.result);
    if (o.text) return String(o.text);
  }
  return '';
}

/** Число из ячейки: number, текст с пробелами/запятой, формула → result. Иначе null. */
function numOf(v: ExcelJS.CellValue): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const s = v.replace(/[\s\u00a0\u2009\u202f]/g, '').replace(/,/g, '.');
    if (!s || s === '-' || s === '—') return null;
    return /^[-+]?\d+(\.\d+)?$/.test(s) ? Number(s) : null;
  }
  if (v instanceof Date) return null;
  if (typeof v === 'object') {
    const o = v as any;
    if ('result' in o) return numOf(o.result);
    if (o.richText) return numOf(o.richText.map((r: any) => r.text ?? '').join(''));
  }
  return null;
}

function dateOf(v: ExcelJS.CellValue): string | null {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === 'object' && 'result' in (v as any)) return dateOf((v as any).result);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

function formulaOf(cell: ExcelJS.Cell): string | null {
  const v = cell.value as any;
  if (v && typeof v === 'object' && typeof v.formula === 'string') return v.formula;
  return null;
}

/** Одно слагаемое-произведение: «2800*2» → 5600 (лево-ассоциативно, * и /). */
function evalTerm(term: string): number | null {
  const m = term.match(/^([+-]?)(\d+(?:\.\d+)?)((?:[*/]\d+(?:\.\d+)?)*)$/);
  if (!m) return null;
  let acc = Number(m[2]);
  const ops = m[3].match(/[*/]\d+(?:\.\d+)?/g) ?? [];
  for (const op of ops) {
    const n = Number(op.slice(1));
    acc = op[0] === '*' ? acc * n : acc / n;
  }
  return m[1] === '-' ? -acc : acc;
}

const parseFallbacks: string[] = [];

/**
 * Разбирает формулу «=2360+648+847-211» на подписанные слагаемые.
 * «2800*2+600» → [5600, 600]. Скобки допускаются только как аддитивные
 * группы (перед «(» — начало, «+» или «(»). Если разобрать нельзя или
 * сумма не сходится с вычисленным результатом — возвращает [result].
 */
function splitTerms(cell: ExcelJS.Cell, context: string): number[] {
  const result = numOf(cell.value);
  if (result == null) return [];
  const f = formulaOf(cell);
  if (f == null) return [result];
  let s = f.replace(/[\s\u00a0\u2009\u202f]/g, '').replace(/,/g, '.');
  if (!/^[0-9+\-*/().]+$/.test(s)) {
    parseFallbacks.push(`${context}: формула «=${f}» не разобрана (внешние ссылки/функции) — взято значение ${result}`);
    return [result];
  }
  if (s.includes('(')) {
    // скобки допустимы, только если каждая открывается в начале или после + либо (
    let ok = true;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(' && !(i === 0 || s[i - 1] === '+' || s[i - 1] === '(')) ok = false;
    }
    if (ok) s = s.replace(/[()]/g, '');
    else {
      parseFallbacks.push(`${context}: формула «=${f}» со скобками не разобрана — взято значение ${result}`);
      return [result];
    }
  }
  const terms = s.match(/[+-]?\d+(?:\.\d+)?(?:[*/]\d+(?:\.\d+)?)*/g);
  if (!terms || terms.join('') !== s) {
    parseFallbacks.push(`${context}: формула «=${f}» не разобрана — взято значение ${result}`);
    return [result];
  }
  const vals = terms.map(evalTerm);
  if (vals.some((x) => x == null)) {
    parseFallbacks.push(`${context}: формула «=${f}» не разобрана — взято значение ${result}`);
    return [result];
  }
  const sum = (vals as number[]).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - result) > 0.011) {
    parseFallbacks.push(`${context}: сумма слагаемых «=${f}» (${sum}) ≠ результату (${result}) — взято значение ${result}`);
    return [result];
  }
  return (vals as number[]).map(round2);
}

// ------------------------------------------- threaded comments (примечания)

const xmlUnescape = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x?([0-9a-fA-F]+);/g, (_, code: string) =>
      String.fromCodePoint(parseInt(code, code.startsWith('x') ? 16 : 10)),
    )
    .replace(/&amp;/g, '&');

/** Читает threaded comments напрямую из xlsx (exceljs их не парсит): лист → {адрес → текст}. */
async function loadThreadedComments(filePath: string): Promise<Map<string, Map<string, string>>> {
  const out = new Map<string, Map<string, string>>();
  const zip = await JSZip.loadAsync(fs.readFileSync(filePath));
  const read = async (p: string) => {
    const f = zip.file(p.replace(/^\//, ''));
    return f ? f.async('string') : null;
  };
  const wb = await read('xl/workbook.xml');
  const wbRels = await read('xl/_rels/workbook.xml.rels');
  if (!wb || !wbRels) return out;
  const relTargets = new Map<string, string>();
  for (const m of wbRels.matchAll(/<Relationship [^>]*>/g)) {
    const id = m[0].match(/ Id="([^"]+)"/)?.[1];
    const target = m[0].match(/ Target="([^"]+)"/)?.[1];
    if (id && target) relTargets.set(id, target);
  }
  for (const m of wb.matchAll(/<sheet [^>]*\/>/g)) {
    const name = m[0].match(/ name="([^"]+)"/)?.[1];
    const rid = m[0].match(/ r:id="([^"]+)"/)?.[1];
    if (!name || !rid) continue;
    const target = relTargets.get(rid);
    if (!target) continue;
    const sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const relsPath = sheetPath.replace(/worksheets\/([^/]+)$/, 'worksheets/_rels/$1.rels');
    const sheetRels = await read(relsPath);
    if (!sheetRels) continue;
    const tc = [...sheetRels.matchAll(/<Relationship [^>]*threadedComment[^>]*\/>/g)]
      .map((r) => r[0].match(/ Target="([^"]+)"/)?.[1])
      .find(Boolean);
    if (!tc) continue;
    const tcPath = tc.startsWith('/') ? tc.slice(1) : path.posix.join(path.posix.dirname(sheetPath), tc);
    const xml = await read(tcPath);
    if (!xml) continue;
    const byRef = new Map<string, string>();
    for (const c of xml.matchAll(/<threadedComment\b([^>]*)>([\s\S]*?)<\/threadedComment>/g)) {
      const ref = c[1].match(/ ref="([^"]+)"/)?.[1];
      const text = c[2].match(/<text>([\s\S]*?)<\/text>/)?.[1];
      if (!ref || text == null) continue;
      const t = xmlUnescape(text).trim();
      if (!t) continue;
      byRef.set(ref, byRef.has(ref) ? `${byRef.get(ref)} | ${t}` : t);
    }
    if (byRef.size) out.set(xmlUnescape(name), byRef);
  }
  return out;
}

/** Примечание ячейки: legacy note или threaded comment. */
function noteOf(cell: ExcelJS.Cell, comments: Map<string, string> | undefined): string | null {
  const n = (cell as any).note;
  if (n) {
    const t = (typeof n === 'string' ? n : (n.texts ?? []).map((x: any) => x.text ?? '').join('')).trim();
    if (t) return t;
  }
  return comments?.get(cell.address) ?? null;
}

const withImportPrefix = (base: string | null, comment: string | null): string | null => {
  const parts = [base, comment].filter(Boolean) as string[];
  return parts.length ? `[импорт] ${parts.join('; ')}` : null;
};

// ---------------------------------------------------------------- типы плана

type TxPlan = {
  date: string;
  amount: number;
  kind: string;
  categoryKey?: string; // «Группа/Название»
  account?: string;
  counterAccount?: string;
  incomeSource?: string;
  note?: string | null;
};
type CompPlan = { date: string; amount: number; fundCat: string; note: string | null };
type SnapshotPlan = { account: string; onDate: string; balance: number };
type AssetPlan = {
  name: string;
  category: string;
  purchaseDate: string;
  initialPrice: number;
  effectivePrice: number;
  termMonths: number;
  adjustments: number[];
  note: string | null;
  purchaseCategoryKey: string;
  capGoal: { target: number; monthly: number; spentAt: string | null } | null;
  capOtl: number; // «отложено» K
  status: string;
};
type FundMovePlan = {
  fundCat: string;
  date: string;
  amount: number;
  kind: 'plan_topup' | 'reimbursement';
  settle: 'from_account' | null;
  note: string | null;
};
type MonthStats = {
  ym: string;
  excelFact: number | null; // B3 листа «Месяц» (без поездок)
  excelTrips: number; // B73
  excelPurchases: number; // сумма ячеек блока «Покупки»
  cashExpenses: number; // «Расходы наличными»
};

const warnings: string[] = [];

// ---------------------------------------------------------------- месяц

async function parseMonth(fileRel: string, ym: string) {
  const filePath = path.join(SRC_DIR, fileRel);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const comments = await loadThreadedComments(filePath);
  const ws = wb.getWorksheet('Месяц');
  if (!ws) fail(`${fileRel}: нет листа «Месяц»`);
  const monthComments = comments.get('Месяц');
  const [yearS, monthS] = ym.split('-');
  const dim = daysInMonth(Number(yearS), Number(monthS));

  // колонка → день месяца (по строке 1)
  const dayByCol = new Map<number, number>();
  for (let c = 3; c <= ws.columnCount; c++) {
    const d = numOf(ws.getRow(1).getCell(c).value);
    if (d != null && Number.isInteger(d) && d >= 1 && d <= 31) dayByCol.set(c, d);
  }
  if (dayByCol.size < 28) fail(`${fileRel}: в строке 1 не найдены номера дней (найдено ${dayByCol.size})`);

  const txs: TxPlan[] = [];
  const comps: CompPlan[] = [];
  const stats: MonthStats = { ym, excelFact: null, excelTrips: 0, excelPurchases: 0, cashExpenses: 0 };

  const dateFor = (col: number): string => {
    const day = dayByCol.get(col)!;
    if (day > dim) fail(`${fileRel}: день ${day} больше числа дней в ${ym}`);
    return `${ym}-${String(day).padStart(2, '0')}`;
  };

  /** Обходит непустые дневные ячейки строки. */
  const eachDayCell = (rowNum: number, cb: (cell: ExcelJS.Cell, date: string) => void) => {
    const row = ws.getRow(rowNum);
    for (const col of dayByCol.keys()) {
      const cell = row.getCell(col);
      const v = numOf(cell.value);
      if (v == null || Math.abs(v) < 0.005) {
        // ячейка с примечанием, но без суммы — не теряем примечание? нет: пропускаем.
        continue;
      }
      cb(cell, dateFor(col));
    }
  };

  const BLOCKS = new Set([
    'Питание', 'Красота', 'Транспортные расходы', 'Бабушки', 'Прочее', 'Покупки',
    'Амортизация', 'Переводы', 'Компенсировано из КС', 'Сбережения', 'Поездки и путешествия',
  ]);

  let block: string | null = null;
  for (let r = 2; r <= ws.rowCount; r++) {
    const label = textOf(ws.getRow(r).getCell(1).value).trim();
    if (!label) {
      block = null;
      continue;
    }
    if (r <= 3 && (label === 'Начисленные' || label === 'фактические')) {
      if (label === 'фактические') stats.excelFact = numOf(ws.getRow(r).getCell(2).value);
      continue;
    }
    if (block == null) {
      if (!BLOCKS.has(label)) fail(`${fileRel}: неизвестный заголовок блока «${label}» (строка ${r})`);
      block = label;
      if (label === 'Поездки и путешествия') stats.excelTrips = numOf(ws.getRow(r).getCell(2).value) ?? 0;
      continue;
    }

    // строка-статья внутри блока
    if (EXPENSE_ROW_MAP[block]) {
      const key = EXPENSE_ROW_MAP[block][label];
      if (!key) fail(`${fileRel}: строка «${label}» блока «${block}» не смаппилась на категорию`);
      eachDayCell(r, (cell, date) => {
        const terms = splitTerms(cell, `${fileRel} ${cell.address}`);
        const note = noteOf(cell, monthComments);
        terms.forEach((amount, i) => {
          if (Math.abs(amount) < 0.005) return;
          txs.push({
            date, amount, kind: 'expense', categoryKey: key, account: 'Т-Банк дебетовая',
            note: i === 0 ? withImportPrefix(null, note) : null,
          });
        });
      });
    } else if (block === 'Покупки') {
      if (!PURCHASE_ROWS.has(label)) fail(`${fileRel}: неизвестная строка «${label}» блока «Покупки»`);
      eachDayCell(r, (cell) => {
        stats.excelPurchases = round2(stats.excelPurchases + (numOf(cell.value) ?? 0));
      });
    } else if (block === 'Амортизация') {
      if (!AMORT_ROWS.has(label)) fail(`${fileRel}: неизвестная строка «${label}» блока «Амортизация»`);
      // начисления генерятся из реестра активов — лист не импортируем
    } else if (block === 'Переводы') {
      const handleTransfer = (to: string, extraNote: string | null = null) => {
        eachDayCell(r, (cell, date) => {
          const v = round2(numOf(cell.value)!);
          const note = withImportPrefix(extraNote, noteOf(cell, monthComments));
          if (v > 0) txs.push({ date, amount: v, kind: 'transfer', account: 'Т-Банк дебетовая', counterAccount: to, note });
          else txs.push({ date, amount: -v, kind: 'transfer', account: to, counterAccount: 'Т-Банк дебетовая', note: withImportPrefix(extraNote ?? 'возврат', noteOf(cell, monthComments)) });
        });
      };
      switch (label) {
        case 'КАП': handleTransfer('НС КАП'); break;
        case 'КС': handleTransfer('НС КС'); break;
        case 'Временный вклад': handleTransfer('Временный вклад (импорт)'); break;
        case 'Снятие наличных': handleTransfer('Наличные ₽'); break;
        case 'Другое': handleTransfer('Выданные долги', 'другое'); break;
        case 'Расходы наличными':
          eachDayCell(r, (cell, date) => {
            const terms = splitTerms(cell, `${fileRel} ${cell.address}`);
            const note = noteOf(cell, monthComments);
            terms.forEach((amount, i) => {
              if (Math.abs(amount) < 0.005) return;
              stats.cashExpenses = round2(stats.cashExpenses + amount);
              txs.push({
                date, amount, kind: 'expense', categoryKey: 'Прочее/Совсем прочее (+КУ)', account: 'Наличные ₽',
                note: i === 0 ? withImportPrefix('расходы наличными', note) : '[импорт] расходы наличными',
              });
            });
          });
          break;
        default: fail(`${fileRel}: неизвестная строка «${label}» блока «Переводы»`);
      }
    } else if (block === 'Компенсировано из КС') {
      const fundCat = COMP_MAP[label];
      if (!fundCat) fail(`${fileRel}: неизвестная строка «${label}» блока «Компенсировано из КС»`);
      eachDayCell(r, (cell, date) => {
        comps.push({
          date, amount: round2(numOf(cell.value)!), fundCat,
          note: withImportPrefix(`компенсация из КС: ${label}`, noteOf(cell, monthComments)),
        });
      });
    } else if (block === 'Сбережения') {
      const to = SAVING_MAP[label];
      if (!to) fail(`${fileRel}: неизвестная строка «${label}» блока «Сбережения»`);
      eachDayCell(r, (cell, date) => {
        txs.push({
          date, amount: round2(numOf(cell.value)!), kind: 'saving',
          account: 'Т-Банк дебетовая', counterAccount: to,
          note: withImportPrefix(null, noteOf(cell, monthComments)),
        });
      });
    } else {
      fail(`${fileRel}: строка «${label}» вне известного блока`);
    }
  }

  // ----- лист «Баланс»: строка «На начало месяца»
  const bs = wb.getWorksheet('Баланс');
  if (!bs) fail(`${fileRel}: нет листа «Баланс»`);
  const norm = (s: string) => s.replace(/[\s\u00a0\u2009\u202f]+/g, ' ').trim();
  for (const bc of BALANCE_COLS) {
    const h1 = norm(textOf(bs.getRow(1).getCell(bc.col).value));
    const h2 = norm(textOf(bs.getRow(2).getCell(bc.col).value));
    if (h1 !== bc.hdr1 || h2 !== bc.hdr2) {
      fail(`${fileRel}: шапка «Баланс» колонки ${bc.col} = «${h1}|${h2}», ожидалось «${bc.hdr1}|${bc.hdr2}»`);
    }
  }
  let startRow = -1;
  for (let r = 1; r <= bs.rowCount; r++) {
    if (textOf(bs.getRow(r).getCell(1).value).includes('На начало месяца')) { startRow = r; break; }
  }
  if (startRow < 0) fail(`${fileRel}: в «Балансе» не найдена строка «На начало месяца»`);
  const snapshots: SnapshotPlan[] = [];
  for (const bc of BALANCE_COLS) {
    const v = numOf(bs.getRow(startRow).getCell(bc.col).value);
    if (v != null && Math.abs(v) > 0.005) {
      snapshots.push({ account: bc.account, onDate: `${ym}-01`, balance: round2(v) });
    }
  }

  return { txs, comps, snapshots, stats };
}

// ---------------------------------------------------------------- амортизация

async function parseAmortization() {
  const filePath = path.join(SRC_DIR, AMORT_FILE);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const comments = await loadThreadedComments(filePath);
  const ws = wb.getWorksheet('Амортизация 2026');
  if (!ws) fail(`${AMORT_FILE}: нет листа «Амортизация 2026»`);
  const shComments = comments.get('Амортизация 2026');
  const today = todayISO();

  const assets: AssetPlan[] = [];
  let block: string | null = null;
  let emptyStreak = 0;
  for (let r = 3; r <= Math.min(ws.rowCount, 400); r++) {
    const row = ws.getRow(r);
    const bLabel = textOf(row.getCell(2).value).trim();
    if (!bLabel) {
      if (++emptyStreak >= 15 && assets.length) break; // конец данных
      continue;
    }
    emptyStreak = 0;
    if (AMORT_BLOCKS[bLabel] !== undefined && dateOf(row.getCell(3).value) == null) {
      block = AMORT_BLOCKS[bLabel];
      continue;
    }
    const purchaseDate = dateOf(row.getCell(3).value);
    const term = numOf(row.getCell(5).value);
    if (purchaseDate == null || term == null) {
      fail(`${AMORT_FILE} строка ${r}: «${bLabel.slice(0, 60)}» — нет даты покупки или срока (не похоже на строку актива)`);
    }
    if (block == null) fail(`${AMORT_FILE} строка ${r}: строка актива вне блока категории`);
    const isDone = block === '__done__';
    const category = isDone ? 'Прочее' : block;

    const priceCell = row.getCell(4);
    const priceResult = numOf(priceCell.value);
    if (priceResult == null) fail(`${AMORT_FILE} строка ${r}: не читается цена`);
    const terms = splitTerms(priceCell, `${AMORT_FILE} D${r}`);
    let initial = round2(terms.filter((t) => t > 0).reduce((a, b) => a + b, 0));
    let adjustments = terms.filter((t) => t < 0).map(round2);
    if (Math.abs(initial + adjustments.reduce((a, b) => a + b, 0) - priceResult) > 0.011 || initial <= 0) {
      warnings.push(`${AMORT_FILE} строка ${r}: цена «${formulaOf(priceCell) ?? priceResult}» — слагаемые не сошлись, взята цена без корректировок`);
      initial = round2(priceResult);
      adjustments = [];
    }
    const effective = round2(priceResult);
    if (effective <= 0) {
      warnings.push(`${AMORT_FILE} строка ${r}: эффективная цена ${effective} ≤ 0 — актив пропущен`);
      continue;
    }

    const status = textOf(row.getCell(14).value).trim().toLowerCase();
    const target = numOf(row.getCell(13).value);
    const otl = numOf(row.getCell(11).value) ?? 0;

    let capGoal: AssetPlan['capGoal'] = null;
    if (status !== 'не применимо' && target != null) {
      let spentAt: string | null = null;
      if (status === 'потрачено') {
        const guess = addMonthsClamped(purchaseDate, term);
        if (guess <= today) spentAt = guess;
        else {
          spentAt = CAP_MOVE_DATE;
          warnings.push(`КАП «${bLabel.slice(0, 50)}»: дата траты не определяется (покупка+срок в будущем) — поставлено ${CAP_MOVE_DATE}`);
        }
      }
      capGoal = { target: round2(target), monthly: round2(target / term), spentAt };
    }

    const cellNotes = [2, 3, 4, 5, 11, 13, 14]
      .map((c) => noteOf(row.getCell(c), shComments))
      .filter(Boolean) as string[];
    const noteParts = [...(isDone ? ['завершено'] : []), ...cellNotes];

    assets.push({
      name: bLabel,
      category,
      purchaseDate,
      initialPrice: initial,
      effectivePrice: effective,
      termMonths: term,
      adjustments,
      note: noteParts.length ? `[импорт] ${noteParts.join('; ')}` : null,
      purchaseCategoryKey: `Покупки/${category}`,
      capGoal,
      capOtl: round2(otl),
      status,
    });
  }
  if (!assets.length) fail(`${AMORT_FILE}: не найдено ни одного актива`);

  // «Детализация КАП» — только контрольная сумма для отчёта
  const det = wb.getWorksheet('Детализация КАП');
  let capControl: { topups: number; spends: number } | null = null;
  if (det) {
    for (let r = 1; r <= Math.min(det.rowCount, 50); r++) {
      const fCell = det.getRow(r).getCell(6);
      const f = formulaOf(fCell);
      if (f && f.includes('SUBTOTAL')) {
        capControl = {
          topups: round2(numOf(fCell.value) ?? 0),
          spends: round2(numOf(det.getRow(r).getCell(8).value) ?? 0),
        };
        break;
      }
    }
  }
  return { assets, capControl };
}

// ---------------------------------------------------------------- доходы

async function parseIncome() {
  const filePath = path.join(SRC_DIR, INCOME_FILE);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const comments = await loadThreadedComments(filePath);
  const ws = wb.getWorksheet('Доходы');
  if (!ws) fail(`${INCOME_FILE}: нет листа «Доходы»`);
  const shComments = comments.get('Доходы');

  const rowByLabel = new Map<string, number>();
  for (let r = 1; r <= Math.min(ws.rowCount, 60); r++) {
    const label = textOf(ws.getRow(r).getCell(1).value).trim();
    if (label && !rowByLabel.has(label)) rowByLabel.set(label, r);
  }

  const txs: TxPlan[] = [];
  for (const m of INCOME_MAP) {
    const r = rowByLabel.get(m.row);
    if (r == null) fail(`${INCOME_FILE}: не найдена строка «${m.row}»`);
    for (let month = 1; month <= 12; month++) {
      const cell = ws.getRow(r).getCell(2 + month); // C..N
      const v = numOf(cell.value);
      if (v == null || Math.abs(v) < 0.005) continue;
      txs.push({
        date: `2026-${String(month).padStart(2, '0')}-15`,
        amount: round2(v),
        kind: 'income',
        incomeSource: m.source,
        counterAccount: m.account ?? 'Т-Банк дебетовая',
        note: withImportPrefix(null, noteOf(cell, shComments)),
      });
    }
  }

  // строка «Итого доходы:» — для сверки
  const totals = new Map<string, number>();
  const totRow = rowByLabel.get('Итого доходы:');
  if (totRow != null) {
    for (let month = 1; month <= 12; month++) {
      const v = numOf(ws.getRow(totRow).getCell(2 + month).value);
      if (v != null) totals.set(`2026-${String(month).padStart(2, '0')}`, round2(v));
    }
  }
  return { txs, totals };
}

// ---------------------------------------------------------------- фонд КС

async function parseSts() {
  const filePath = path.join(SRC_DIR, STS_FILE);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const comments = await loadThreadedComments(filePath);
  const ws = wb.getWorksheet('КС');
  if (!ws) fail(`${STS_FILE}: нет листа «КС»`);
  const shComments = comments.get('КС');

  const updates: Array<{ fundCat: string; opening: number; monthlyPlan: number }> = [];
  const moves: FundMovePlan[] = [];
  const excelSaldo = new Map<string, number | null>();

  for (let r = 3; r <= Math.min(ws.rowCount, 60); r++) {
    const row = ws.getRow(r);
    const label = textOf(row.getCell(1).value).trim();
    if (!label || STS_GROUP_ROWS.has(label)) continue;
    const fundCat = STS_MAP[label];
    if (!fundCat) {
      // ниже таблицы бывают текстовые пометки в колонке B — колонка A у них пустая;
      // непустая колонка A без маппинга — ошибка структуры
      fail(`${STS_FILE} строка ${r}: статья «${label}» не смаппилась на fund_categories`);
    }
    const opening = numOf(row.getCell(3).value) ?? 0;
    const plan = numOf(row.getCell(4).value) ?? 0;
    updates.push({ fundCat, opening: round2(opening), monthlyPlan: round2(plan) });
    excelSaldo.set(fundCat, numOf(row.getCell(2).value));

    for (let month = 1; month <= 12; month++) {
      const otlCell = row.getCell(3 + month * 2); // E,G,I…
      const spentCell = row.getCell(4 + month * 2); // F,H,J…
      const mm = String(month).padStart(2, '0');
      const otl = numOf(otlCell.value);
      if (otl != null && Math.abs(otl) > 0.005) {
        if (otl < 0) warnings.push(`${STS_FILE}: отрицательное «отл.» ${otl} у «${label}» за месяц ${mm}`);
        moves.push({
          fundCat, date: `2026-${mm}-01`, amount: round2(otl), kind: 'plan_topup', settle: null,
          note: withImportPrefix('КС план', noteOf(otlCell, shComments)),
        });
      }
      const spent = numOf(spentCell.value);
      if (spent != null && Math.abs(spent) > 0.005) {
        moves.push({
          fundCat, date: `2026-${mm}-15`, amount: round2(-spent), kind: 'reimbursement', settle: 'from_account',
          note: withImportPrefix('КС израсходовано', noteOf(spentCell, shComments)),
        });
      }
    }
  }
  if (!updates.length) fail(`${STS_FILE}: не найдено ни одной статьи`);
  const totalSaldo = numOf(ws.getRow(3).getCell(2).value);
  return { updates, moves, excelSaldo, totalSaldo };
}

// ------------------------------------------------------------- consolidated

async function parseConsolidated() {
  const filePath = path.join(SRC_DIR, CONSOLIDATED_FILE);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet('Сводка');
  const fact = new Map<string, number>();
  if (!ws) {
    warnings.push(`${CONSOLIDATED_FILE}: нет листа «Сводка» — сверка пропущена`);
    return { fact };
  }
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    if (textOf(ws.getRow(r).getCell(1).value).trim() === 'фактические') {
      for (let month = 1; month <= 12; month++) {
        const v = numOf(ws.getRow(r).getCell(2 + month).value);
        if (v != null) fact.set(`2026-${String(month).padStart(2, '0')}`, round2(v));
      }
      break;
    }
  }
  return { fact };
}

// ---------------------------------------------------------------- запись в БД

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
const money = (n: number) => n.toFixed(2);

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) fail('DATABASE_URL не задан (нужен .env.local)');
  const pool = new Pool({ connectionString: url, max: 3 });
  const db = drizzle(pool, { schema });

  console.log('— Парсинг Excel…');
  const months = [] as Array<Awaited<ReturnType<typeof parseMonth>>>;
  for (const mf of MONTH_FILES) months.push(await parseMonth(mf.file, mf.ym));
  const amort = await parseAmortization();
  const income = await parseIncome();
  const sts = await parseSts();
  const consolidated = await parseConsolidated();

  const allMonthTxs = months.flatMap((m) => m.txs);
  const allComps = months.flatMap((m) => m.comps);
  const allSnapshots = months.flatMap((m) => m.snapshots);

  console.log(
    `  месяцы: ${allMonthTxs.length} операций, ${allComps.length} компенсаций, ${allSnapshots.length} снимков; ` +
    `активы: ${amort.assets.length}; доходы: ${income.txs.length}; движения КС: ${sts.moves.length}`,
  );

  console.log('— Запись в БД…');
  const counts = {
    transactions: 0, assets: 0, adjustments: 0, accruals: 0,
    capGoals: 0, capMovements: 0, fundMovements: 0, snapshots: 0,
  };

  await db.transaction(async (tx) => {
    await tx.execute(sql`
      TRUNCATE transactions, amortization_accruals, asset_adjustments, cap_movements,
        cap_goals, assets, fund_movements, account_snapshots, obligations
      RESTART IDENTITY CASCADE
    `);

    // --- служебные счета (ON CONFLICT DO NOTHING)
    const debitId = (
      await tx.select({ id: schema.accounts.id }).from(schema.accounts)
        .where(eq(schema.accounts.name, 'Т-Банк дебетовая'))
    )[0]?.id;
    if (!debitId) fail('в БД нет счёта «Т-Банк дебетовая» — прогоните seed');
    await tx.insert(schema.accounts).values([
      {
        name: 'Временный вклад (импорт)', type: 'deposit', depositKind: 'interest',
        sourceAccountId: debitId, currency: 'RUB', sortOrder: 100,
        note: '[импорт] временные вклады из месячных Excel-файлов',
      },
      {
        name: 'Доллары (по цене покупки)', type: 'brokerage', currency: 'RUB', sortOrder: 101,
        note: '[импорт] наличные доллары по рублёвой цене покупки (счёт «Наличные $» — в USD)',
      },
    ]).onConflictDoNothing({ target: schema.accounts.name });

    // --- служебные статьи фонда
    await tx.insert(schema.fundCategories).values(
      SERVICE_FUND_CATS.map((c) => ({ name: c.name, groupName: c.groupName, sortOrder: c.sortOrder })),
    ).onConflictDoNothing({ target: schema.fundCategories.name });

    // --- справочники в память
    const accounts = new Map(
      (await tx.select({ id: schema.accounts.id, name: schema.accounts.name }).from(schema.accounts))
        .map((a) => [a.name, a.id]),
    );
    const cats = new Map(
      (await tx.select({
        id: schema.categories.id, name: schema.categories.name, group: schema.categoryGroups.name,
      }).from(schema.categories)
        .innerJoin(schema.categoryGroups, eq(schema.categories.groupId, schema.categoryGroups.id)))
        .map((c) => [`${c.group}/${c.name}`, c.id]),
    );
    const incomeSources = new Map(
      (await tx.select({ id: schema.incomeSources.id, name: schema.incomeSources.name }).from(schema.incomeSources))
        .map((s) => [s.name, s.id]),
    );
    const fundCats = new Map(
      (await tx.select({ id: schema.fundCategories.id, name: schema.fundCategories.name }).from(schema.fundCategories))
        .map((f) => [f.name, f.id]),
    );
    const assetCats = new Map(
      (await tx.select({ id: schema.assetCategories.id, name: schema.assetCategories.name }).from(schema.assetCategories))
        .map((a) => [a.name, a.id]),
    );
    const accId = (name: string) => accounts.get(name) ?? fail(`нет счёта «${name}» в БД`);
    const catId = (key: string) => cats.get(key) ?? fail(`нет категории «${key}» в БД`);

    // --- UPDATE статей КС
    for (const u of sts.updates) {
      const id = fundCats.get(u.fundCat) ?? fail(`нет статьи фонда «${u.fundCat}» в БД`);
      await tx.update(schema.fundCategories)
        .set({ openingBalance: money(u.opening), monthlyPlan: money(u.monthlyPlan) })
        .where(eq(schema.fundCategories.id, id));
    }

    // --- активы, корректировки, начисления, покупки, цели КАП
    for (const a of amort.assets) {
      const assetCatId = assetCats.get(a.category) ?? fail(`нет категории активов «${a.category}»`);
      const [{ id: assetId }] = await tx.insert(schema.assets).values({
        name: a.name, assetCategoryId: assetCatId, purchaseDate: a.purchaseDate,
        initialPrice: money(a.initialPrice), termMonths: a.termMonths, note: a.note,
      }).returning({ id: schema.assets.id });
      counts.assets++;

      if (a.adjustments.length) {
        await tx.insert(schema.assetAdjustments).values(a.adjustments.map((amt) => ({
          assetId, date: a.purchaseDate, amount: money(amt), reason: '[импорт] зачёт/продажа',
        })));
        counts.adjustments += a.adjustments.length;
      }

      const sched = buildSchedule(a.effectivePrice, a.purchaseDate, a.termMonths);
      for (const part of chunk(sched, 500)) {
        await tx.insert(schema.amortizationAccruals).values(part.map((s) => ({
          assetId, seqNo: s.seqNo, accrualDate: s.accrualDate, amount: money(s.amount),
        })));
      }
      counts.accruals += sched.length;

      await tx.insert(schema.transactions).values({
        date: a.purchaseDate, amount: money(a.effectivePrice), kind: 'purchase',
        categoryId: catId(a.purchaseCategoryKey), accountId: accId('Т-Банк дебетовая'),
        assetId, note: a.note,
      });
      counts.transactions++;

      if (a.capGoal) {
        const [{ id: goalId }] = await tx.insert(schema.capGoals).values({
          assetId, name: a.name, targetAmount: money(a.capGoal.target), inflationRate: CAP_INFLATION,
          termMonths: a.termMonths, monthlyContribution: money(a.capGoal.monthly),
          spentAt: a.capGoal.spentAt, note: null,
        }).returning({ id: schema.capGoals.id });
        counts.capGoals++;
        if (Math.abs(a.capOtl) > 0.005) {
          await tx.insert(schema.capMovements).values({
            capGoalId: goalId, date: CAP_MOVE_DATE, amount: money(a.capOtl), source: 'recalc',
            note: '[импорт] отложено по Excel',
          });
          counts.capMovements++;
          if (a.status === 'потрачено') {
            await tx.insert(schema.capMovements).values({
              capGoalId: goalId, date: CAP_MOVE_DATE, amount: money(-a.capOtl), source: 'spend',
              note: '[импорт] потрачено по Excel',
            });
            counts.capMovements++;
          }
        }
      }
    }

    // --- операции месячных файлов и доходы
    const toRow = (t: TxPlan) => ({
      date: t.date, amount: money(t.amount), kind: t.kind,
      categoryId: t.categoryKey ? catId(t.categoryKey) : null,
      accountId: t.account ? accId(t.account) : null,
      counterAccountId: t.counterAccount ? accId(t.counterAccount) : null,
      incomeSourceId: t.incomeSource
        ? (incomeSources.get(t.incomeSource) ?? fail(`нет источника дохода «${t.incomeSource}»`))
        : null,
      note: t.note ?? null,
    });
    for (const part of chunk([...allMonthTxs, ...income.txs], 400)) {
      await tx.insert(schema.transactions).values(part.map(toRow));
      counts.transactions += part.length;
    }

    // --- компенсации из КС: транзакция со счёта НС КС + движение фонда
    for (const c of allComps) {
      const fundCatId = fundCats.get(c.fundCat) ?? fail(`нет статьи фонда «${c.fundCat}»`);
      const [{ id: txId }] = await tx.insert(schema.transactions).values({
        date: c.date, amount: money(c.amount), kind: 'reimbursement',
        accountId: accId('НС КС'), fundCategoryId: fundCatId, note: c.note,
      }).returning({ id: schema.transactions.id });
      counts.transactions++;
      await tx.insert(schema.fundMovements).values({
        fundCategoryId: fundCatId, date: c.date, amount: money(-c.amount), kind: 'reimbursement',
        settle: 'from_account', offsetAppliedAt: null, transactionId: txId, note: c.note,
      });
      counts.fundMovements++;
    }

    // --- движения фонда из STS (без банковских транзакций)
    for (const part of chunk(sts.moves, 400)) {
      await tx.insert(schema.fundMovements).values(part.map((m) => ({
        fundCategoryId: fundCats.get(m.fundCat) ?? fail(`нет статьи фонда «${m.fundCat}»`),
        date: m.date, amount: money(m.amount), kind: m.kind, settle: m.settle,
        offsetAppliedAt: null, transactionId: null, note: m.note,
      })));
      counts.fundMovements += part.length;
    }

    // --- снимки балансов
    if (allSnapshots.length) {
      await tx.insert(schema.accountSnapshots).values(allSnapshots.map((s) => ({
        accountId: accId(s.account), onDate: s.onDate, balance: money(s.balance),
        note: '[импорт] «На начало месяца» из Excel',
      })));
      counts.snapshots = allSnapshots.length;
    }
  });

  console.log(
    `  записано: transactions=${counts.transactions}, assets=${counts.assets}, ` +
    `asset_adjustments=${counts.adjustments}, accruals=${counts.accruals}, cap_goals=${counts.capGoals}, ` +
    `cap_movements=${counts.capMovements}, fund_movements=${counts.fundMovements}, snapshots=${counts.snapshots}`,
  );

  // ------------------------------------------------------------- отчёт сверки
  const q = async (text: string): Promise<any[]> => (await pool.query(text)).rows;
  const fmt = (n: number | null | undefined) =>
    n == null ? '      n/a' : n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).padStart(14);
  const flag = (a: number | null, b: number | null) => {
    if (a == null || b == null) return '';
    const d = Math.abs(a - b);
    return d > 500 && d / Math.max(Math.abs(a), Math.abs(b), 1) > 0.01 ? '  ⚠ ВАЖНО' : '';
  };

  console.log('\n================ ОТЧЁТ СВЕРКИ ================');

  const dbExp = await q(`
    SELECT to_char(date, 'YYYY-MM') ym,
           round(sum(amount), 2)::float8 total,
           round(sum(amount) FILTER (WHERE row_type <> 'trip'), 2)::float8 no_trips,
           round(sum(amount) FILTER (WHERE row_type = 'trip'), 2)::float8 trips,
           round(sum(amount) FILTER (WHERE src = 'purchase'), 2)::float8 purchases
    FROM v_expenses_actual GROUP BY 1 ORDER BY 1`);
  const dbExpBy = new Map(dbExp.map((r) => [r.ym, r]));

  console.log('\n— Расходы по месяцам (v_expenses_actual), ₽:');
  console.log('  месяц    | БД всего       | БД без поездок | Excel B3 («фактические»)');
  for (const m of months) {
    const row = dbExpBy.get(m.stats.ym);
    const dbNoTrips = row?.no_trips ?? 0;
    console.log(
      `  ${m.stats.ym} |${fmt(row?.total ?? 0)} |${fmt(dbNoTrips)} |${fmt(m.stats.excelFact)}` +
      `${flag(dbNoTrips, m.stats.excelFact)}`,
    );
  }
  console.log('  (БД «без поездок» ≠ Excel B3 ожидаемо: в БД покупки датированы по реестру амортизации,');
  console.log('   плюс расходы наличными учтены как расходы, а в Excel они в блоке «Переводы».)');

  console.log('\n— Разложение расхождения: сопоставимая величина = БД без поездок − расх. наличными − (покупки реестра − покупки Excel):');
  console.log('  месяц    | покупки Excel  | покупки реестр | расх. наличными | сопоставимая vs Excel B3');
  for (const m of months) {
    const row = dbExpBy.get(m.stats.ym);
    const purReg = row?.purchases ?? 0;
    const trips = row?.trips ?? 0;
    const adj = round2((row?.no_trips ?? 0) - m.stats.cashExpenses - (purReg - m.stats.excelPurchases));
    let suffix = flag(adj, m.stats.excelFact);
    if (suffix && m.stats.excelFact != null && Math.abs(round2(adj + trips) - m.stats.excelFact) <= 0.011) {
      suffix = `  (сходится с поездками: ${fmt(round2(adj + trips)).trim()} — B3 этого файла включает поездки)`;
    }
    console.log(
      `  ${m.stats.ym} |${fmt(m.stats.excelPurchases)} |${fmt(purReg)} |${fmt(m.stats.cashExpenses)} |${fmt(adj)} vs${fmt(m.stats.excelFact)}${suffix}`,
    );
  }
  console.log('  (расхождение «покупки Excel vs реестр» — покупки, внесённые только в один из двух файлов Excel)');

  console.log('\n— Поездки, ₽:');
  for (const m of months) {
    const trips = dbExpBy.get(m.stats.ym)?.trips ?? 0;
    if (Math.abs(trips) > 0.005 || Math.abs(m.stats.excelTrips) > 0.005) {
      console.log(`  ${m.stats.ym} | БД ${fmt(trips)} | Excel B73 ${fmt(m.stats.excelTrips)}${flag(trips, m.stats.excelTrips)}`);
    }
  }

  console.log('\n— Сверка с consolidated (строка «фактические»), ₽:');
  console.log('  (consolidated для июня–августа включает поездки, для марта–мая — нет;');
  console.log('   «сопоставимая» = БД − расх. наличными − (покупки реестра − покупки Excel))');
  for (const m of months) {
    const row = dbExpBy.get(m.stats.ym);
    const cons = consolidated.fact.get(m.stats.ym) ?? null;
    const withTrips = ['2026-06', '2026-07', '2026-08'].includes(m.stats.ym);
    const dbVal = withTrips ? (row?.total ?? 0) : (row?.no_trips ?? 0);
    const comparable = round2(dbVal - m.stats.cashExpenses - ((row?.purchases ?? 0) - m.stats.excelPurchases));
    console.log(
      `  ${m.stats.ym} | БД${withTrips ? ' (с поездками)' : ' (без поездок)'}${fmt(dbVal)} | сопоставимая${fmt(comparable)} | consolidated${fmt(cons)}${flag(comparable, cons)}`,
    );
  }

  const dbInc = await q(`
    SELECT to_char(date, 'YYYY-MM') ym, round(sum(amount), 2)::float8 total
    FROM transactions WHERE kind = 'income' GROUP BY 1 ORDER BY 1`);
  console.log('\n— Доходы по месяцам, ₽ (даты условные — 15-е число):');
  for (const r of dbInc) {
    const excel = income.totals.get(r.ym) ?? null;
    console.log(`  ${r.ym} | БД${fmt(r.total)} | Excel «Итого доходы»${fmt(excel)}${flag(r.total, excel)}`);
  }

  console.log('\n— Фонд КС: сальдо по статьям (opening + движения), ₽:');
  const dbFund = await q(`
    SELECT fc.name, fc.group_name,
           round(fc.opening_balance + COALESCE(sum(fm.amount), 0), 2)::float8 saldo
    FROM fund_categories fc
    LEFT JOIN fund_movements fm ON fm.fund_category_id = fc.id
    GROUP BY fc.id ORDER BY fc.sort_order`);
  let excelTotal = 0;
  let dbTotalReal = 0;
  for (const r of dbFund) {
    if (String(r.name).startsWith('(импорт)')) continue;
    const excel = sts.excelSaldo.has(r.name) ? (sts.excelSaldo.get(r.name) ?? 0) : null;
    if (excel != null) excelTotal = round2(excelTotal + excel);
    dbTotalReal = round2(dbTotalReal + r.saldo);
    console.log(`  ${String(r.name).padEnd(24)} | БД${fmt(r.saldo)} | Excel B${fmt(excel)}${flag(r.saldo, excel)}`);
  }
  console.log(`  ${'ИТОГО (реальные статьи)'.padEnd(24)} | БД${fmt(dbTotalReal)} | Excel B3${fmt(sts.totalSaldo ?? excelTotal)}${flag(dbTotalReal, sts.totalSaldo ?? excelTotal)}`);
  console.log('  Служебные статьи «(импорт) …» (двойник компенсаций из месячных файлов, Виктория разнесёт вручную):');
  for (const r of dbFund) {
    if (!String(r.name).startsWith('(импорт)')) continue;
    console.log(`  ${String(r.name).padEnd(24)} | БД${fmt(r.saldo)}`);
  }

  const [{ ks_balance }] = await q(`
    SELECT round(balance, 2)::float8 ks_balance FROM v_account_balances WHERE name = 'НС КС'`);
  const fundTotalAll = dbFund.reduce((a, r) => round2(a + r.saldo), 0);
  console.log(`\n— Счёт «НС КС» по банковским операциям: ${fmt(ks_balance)} ₽; фонд (все статьи, с учётом служебных): ${fmt(fundTotalAll)} ₽`);
  console.log('  Расхождение счёта и фонда ожидаемо (рассинхрон Excel, вопрос №9): движения фонда из STS не привязаны к банковским переводам.');

  const capLedger = await q(`
    SELECT round(sum(amount), 2)::float8 s FROM cap_movements`);
  const capOtl = await q(`
    SELECT round(sum(amount), 2)::float8 s FROM cap_movements WHERE source = 'recalc'`);
  console.log('\n— КАП:');
  console.log(`  Отложено по целям (recalc): ${fmt(capOtl[0].s)} ₽; леджер целей (recalc − spend): ${fmt(capLedger[0].s)} ₽`);
  if (amort.capControl) {
    const detNet = round2(amort.capControl.topups - amort.capControl.spends);
    console.log(`  «Детализация КАП» (контроль): пополнения ${fmt(amort.capControl.topups)} − списания ${fmt(amort.capControl.spends)} = ${fmt(detNet)} ₽ vs леджер БД ${fmt(capLedger[0].s)}${flag(detNet, capLedger[0].s)}`);
  }

  const [assetCount] = await q(`SELECT count(*)::int c FROM assets`);
  const [goalCount] = await q(`SELECT count(*)::int c FROM cap_goals`);
  const [spentCount] = await q(`SELECT count(*)::int c FROM cap_goals WHERE spent_at IS NOT NULL`);
  const [snapCount] = await q(`SELECT count(*)::int c FROM account_snapshots`);
  const [txByKind] = [await q(`SELECT kind, count(*)::int c FROM transactions GROUP BY kind ORDER BY kind`)];
  console.log(`\n— Активов: ${assetCount.c}; целей КАП: ${goalCount.c} (из них потрачено: ${spentCount.c}); снимков балансов: ${snapCount.c}`);
  console.log('  Транзакции по видам: ' + txByKind.map((r: any) => `${r.kind}=${r.c}`).join(', '));

  if (parseFallbacks.length) {
    console.log(`\n— Формулы, взятые одним значением (${parseFallbacks.length}):`);
    for (const p of parseFallbacks) console.log('  • ' + p);
  }
  if (warnings.length) {
    console.log(`\n— Предупреждения (${warnings.length}):`);
    for (const w of warnings) console.log('  • ' + w);
  }

  console.log('\n— Допущения импорта: см. docs/IMPORT.md');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
