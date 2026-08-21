/**
 * Идемпотентный seed справочников: структура категорий, счетов, источников
 * дохода и статей фонда КС повторяет Excel-файлы «Бюджет-эксель».
 * Запуск: npm run db:seed
 */
import { db } from './index';
import {
  accounts,
  assetCategories,
  categories,
  categoryGroups,
  fundCategories,
  incomeSources,
  settings,
} from './schema';
import { eq, and } from 'drizzle-orm';

async function upsertGroup(name: string, sortOrder: number) {
  const [existing] = await db
    .select()
    .from(categoryGroups)
    .where(eq(categoryGroups.name, name));
  if (existing) return existing.id;
  const [row] = await db.insert(categoryGroups).values({ name, sortOrder }).returning();
  return row.id;
}

async function upsertCategory(
  groupId: number,
  name: string,
  sortOrder: number,
  rowType: 'expense' | 'trip' = 'expense',
) {
  const [existing] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.groupId, groupId), eq(categories.name, name)));
  if (existing) return existing.id;
  const [row] = await db
    .insert(categories)
    .values({ groupId, name, sortOrder, rowType })
    .returning();
  return row.id;
}

async function main() {
  // -------------------------------------------------- категории трат
  const groups: Record<string, [string, ...string[]][]> = {};
  const structure: [string, string[], ('expense' | 'trip')?][] = [
    ['Питание', ['Продукты', 'Кафе, рестораны, доставка']],
    [
      'Красота',
      [
        'Маникюр и педикюр',
        'Процедуры для волос',
        'Спорт',
        'Массаж, лазер, косметолог',
        'Уходовая косметика',
        'Косметика для волос',
        'Гигиена, аксессуары, декоративка',
      ],
    ],
    ['Транспорт', ['Общественный транспорт, самокат', 'Такси']],
    ['Бабушки', ['Ежемесячные деньги', 'Цветы, подарки, другое']],
    [
      'Прочее',
      [
        'Подписки, интернет, связь',
        'Домашний кальян',
        'Благотворительность',
        'Химчистка',
        'Всё для дома',
        'Лечение',
        'Писюха',
        'Эл. книги и канцтовары',
        'Совсем прочее (+КУ)',
      ],
    ],
    ['Покупки', ['Одежда', 'Красота и здоровье', 'Техника', 'Прочее', 'Книги']],
    ['Амортизация', ['Одежда', 'Красота и здоровье', 'Техника', 'Прочее', 'Книги']],
    [
      'Поездки',
      ['Билеты', 'Жильё', 'Котоняня', 'Питание в поездке', 'Проезд', 'Кальяны', 'Другое'],
      'trip',
    ],
  ];

  const categoryIds: Record<string, Record<string, number>> = {};
  let g = 0;
  for (const [groupName, subs, rowType] of structure) {
    const groupId = await upsertGroup(groupName, g++);
    categoryIds[groupName] = {};
    let s = 0;
    for (const sub of subs) {
      categoryIds[groupName][sub] = await upsertCategory(groupId, sub, s++, rowType ?? 'expense');
    }
  }
  void groups;

  // -------------------------------------------------- категории активов
  const assetCats: [string, string][] = [
    ['Одежда', 'Одежда'],
    ['Красота и здоровье', 'Красота и здоровье'],
    ['Техника', 'Техника'],
    ['Прочее', 'Прочее'],
    ['Книги', 'Книги'],
  ];
  let acSort = 0;
  for (const [name, amortSub] of assetCats) {
    const [existing] = await db.select().from(assetCategories).where(eq(assetCategories.name, name));
    if (!existing) {
      await db.insert(assetCategories).values({
        name,
        expenseCategoryId: categoryIds['Амортизация'][amortSub],
        sortOrder: acSort,
      });
    }
    acSort++;
  }

  // -------------------------------------------------- счета
  const accountRows: (typeof accounts.$inferInsert)[] = [
    { name: 'Т-Банк дебетовая', type: 'checking', sortOrder: 0 },
    { name: 'Т-Банк кредитка', type: 'credit_card', sortOrder: 1 },
    { name: 'НС КАП', type: 'savings_cap', sortOrder: 2 },
    { name: 'НС КС', type: 'savings_ks', sortOrder: 3 },
    { name: 'Наличные ₽', type: 'cash', sortOrder: 4 },
    { name: 'Наличные $', type: 'cash', currency: 'USD', sortOrder: 5 },
    { name: 'Драгоценные металлы', type: 'metals', sortOrder: 6 },
    { name: 'Фондовый рынок', type: 'brokerage', sortOrder: 7 },
    { name: 'Долгосрочный вклад Т-Банк', type: 'deposit', depositKind: 'long_term', sortOrder: 8 },
    { name: 'Долгосрочный вклад ВТБ', type: 'deposit', depositKind: 'long_term', sortOrder: 9 },
  ];
  for (const row of accountRows) {
    await db.insert(accounts).values(row).onConflictDoNothing({ target: accounts.name });
  }

  // -------------------------------------------------- источники дохода
  const sources: (typeof incomeSources.$inferInsert)[] = [
    { name: 'Большевик (квартира)', type: 'rent', sortOrder: 0 },
    { name: 'Большевик (кладовка)', type: 'rent', sortOrder: 1 },
    { name: 'Машиноместо 1', type: 'rent', sortOrder: 2 },
    { name: 'Машиноместо 2', type: 'rent', sortOrder: 3 },
    { name: 'Ежемесячный платёж', type: 'monthly_payment', expectedMonthly: '150000', sortOrder: 4 },
    { name: 'Компенсации', type: 'compensation', sortOrder: 5 },
    { name: 'Продажи (Авито и др.)', type: 'one_off', sortOrder: 6 },
    { name: 'Проценты по вкладам', type: 'interest_cashback', sortOrder: 7 },
    { name: 'Проценты по НС', type: 'interest_cashback', sortOrder: 8 },
    { name: 'Кэшбек', type: 'interest_cashback', sortOrder: 9 },
    { name: 'Возврат долга', type: 'one_off', sortOrder: 10 },
    { name: 'Доходы наличными', type: 'cash_income', sortOrder: 11 },
    { name: 'Прочее', type: 'one_off', sortOrder: 12 },
  ];
  for (const row of sources) {
    await db.insert(incomeSources).values(row).onConflictDoNothing({ target: incomeSources.name });
  }

  // -------------------------------------------------- статьи фонда КС
  const fund: [string, string, number][] = [
    ['Красота', 'Лазер', 2000],
    ['Красота', 'Волосы (процедуры)', 3500],
    ['Красота', 'Косметология', 7500],
    ['Красота', 'Косметика', 1000],
    ['Бабушки', 'Санаторий Аня', 8000],
    ['Бабушки', 'Новый год', 0],
    ['Бабушки', '8 марта', 850],
    ['Бабушки', 'День рождения Аня', 850],
    ['Бабушки', 'День рождения Зина', 450],
    ['Бабушки', 'Встречи', 2000],
    ['Прочее', 'Лечение', 4000],
    ['Прочее', 'Налоги', 5000],
    ['Прочее', 'Химчистка', 2000],
    ['Прочее', 'Большевик', 2000],
    ['Прочее', 'Фильтр для воды', 3600],
    ['Прочее', 'Ремонт Loftec', 1000],
    ['Прочее', 'На дни рождения', 2000],
    ['Прочее', 'ВПН', 550],
    ['Прочее', 'Лорашка', 1000],
    ['Прочее', 'Путешествия по России', 1000],
  ];
  let fSort = 0;
  for (const [groupName, name, plan] of fund) {
    await db
      .insert(fundCategories)
      .values({ name, groupName, monthlyPlan: String(plan), sortOrder: fSort++ })
      .onConflictDoNothing({ target: fundCategories.name });
  }

  // -------------------------------------------------- настройки
  const defaultSettings: [string, unknown][] = [
    ['cap_inflation_rate', 1.1],
    ['default_account', 'Т-Банк дебетовая'],
  ];
  for (const [key, value] of defaultSettings) {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoNothing({ target: settings.key });
  }

  console.log('Seed complete');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
