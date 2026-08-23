import {
  pgTable,
  bigint,
  text,
  date,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  uuid,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const id = () => bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity();
const money = (name: string) => numeric(name, { precision: 14, scale: 2 });

// ---------------------------------------------------------------- справочники

export const categoryGroups = pgTable('category_groups', {
  id: id(),
  name: text('name').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  activeFrom: date('active_from').notNull().default('2000-01-01'),
  activeTo: date('active_to'),
});

export const categories = pgTable(
  'categories',
  {
    id: id(),
    groupId: bigint('group_id', { mode: 'number' })
      .notNull()
      .references(() => categoryGroups.id),
    name: text('name').notNull(),
    // expense — обычная операционная категория; trip — поездки (годовая категория, вопрос №24)
    rowType: text('row_type').notNull().default('expense'),
    sortOrder: integer('sort_order').notNull().default(0),
    activeFrom: date('active_from').notNull().default('2000-01-01'),
    activeTo: date('active_to'),
    // помечена к удалению: висит предупреждение, пока по ней остаются данные
    pendingDelete: boolean('pending_delete').notNull().default(false),
  },
  (t) => [
    uniqueIndex('categories_group_name_uq').on(t.groupId, t.name),
    check('categories_row_type_chk', sql`${t.rowType} in ('expense','trip')`),
  ],
);

/** Дни, отмеченные «заполненными» — подсвечиваются в матрице месяца. */
export const filledDays = pgTable('filled_days', {
  date: date('date').primaryKey(),
});

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    name: text('name').notNull().unique(),
    type: text('type').notNull(),
    // для type='deposit': long_term — долгосрочное сбережение, interest — процентный (тело возвращается)
    depositKind: text('deposit_kind'),
    // для процентного вклада: счёт, на который возвращается тело при закрытии
    sourceAccountId: bigint('source_account_id', { mode: 'number' }),
    currency: text('currency').notNull().default('RUB'),
    isActive: boolean('is_active').notNull().default(true),
    includeInTotal: boolean('include_in_total').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    note: text('note'),
  },
  (t) => [
    check(
      'accounts_type_chk',
      sql`${t.type} in ('checking','credit_card','savings_cap','savings_ks','deposit','cash','metals','brokerage')`,
    ),
    check('accounts_currency_chk', sql`${t.currency} in ('RUB','USD')`),
    check(
      'accounts_deposit_kind_chk',
      sql`${t.depositKind} is null or ${t.depositKind} in ('long_term','interest')`,
    ),
  ],
);

export const accountSnapshots = pgTable(
  'account_snapshots',
  {
    id: id(),
    accountId: bigint('account_id', { mode: 'number' })
      .notNull()
      .references(() => accounts.id),
    onDate: date('on_date').notNull(), // остаток на утро этой даты
    balance: money('balance').notNull(),
    note: text('note'),
  },
  (t) => [uniqueIndex('account_snapshots_uq').on(t.accountId, t.onDate)],
);

export const incomeSources = pgTable(
  'income_sources',
  {
    id: id(),
    name: text('name').notNull().unique(),
    type: text('type').notNull(),
    expectedMonthly: money('expected_monthly'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
  },
  (t) => [
    check(
      'income_sources_type_chk',
      sql`${t.type} in ('rent','one_off','interest_cashback','monthly_payment','cash_income','compensation')`,
    ),
  ],
);

// ------------------------------------------------------- активы и амортизация

export const assetCategories = pgTable('asset_categories', {
  id: id(),
  name: text('name').notNull().unique(),
  // в какую категорию расходов ложится амортизация в «начисленном» методе
  expenseCategoryId: bigint('expense_category_id', { mode: 'number' }).references(
    () => categories.id,
  ),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const assets = pgTable(
  'assets',
  {
    id: id(),
    name: text('name').notNull(),
    assetCategoryId: bigint('asset_category_id', { mode: 'number' })
      .notNull()
      .references(() => assetCategories.id),
    purchaseDate: date('purchase_date').notNull(),
    initialPrice: money('initial_price').notNull(),
    termMonths: integer('term_months').notNull(),
    // дата досрочного завершения: начисления после неё удаляются, прошлые сохраняются
    disposedAt: date('disposed_at'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('assets_term_chk', sql`${t.termMonths} between 1 and 120`),
    check('assets_price_chk', sql`${t.initialPrice} > 0`),
    index('assets_category_idx').on(t.assetCategoryId),
  ],
);

export const assetAdjustments = pgTable(
  'asset_adjustments',
  {
    id: id(),
    assetId: bigint('asset_id', { mode: 'number' })
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    amount: money('amount').notNull(), // минус = уменьшение базы (перепродажа, зачёт старого)
    reason: text('reason'),
  },
  (t) => [index('asset_adjustments_asset_idx').on(t.assetId)],
);

export const amortizationAccruals = pgTable(
  'amortization_accruals',
  {
    id: id(),
    assetId: bigint('asset_id', { mode: 'number' })
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    seqNo: integer('seq_no').notNull(),
    accrualDate: date('accrual_date').notNull(),
    amount: money('amount').notNull(),
  },
  (t) => [
    uniqueIndex('amortization_accruals_uq').on(t.assetId, t.seqNo),
    index('amortization_accruals_date_idx').on(t.accrualDate),
  ],
);

// --------------------------------------------------------------------- КАП

export const capGoals = pgTable(
  'cap_goals',
  {
    id: id(),
    assetId: bigint('asset_id', { mode: 'number' })
      .unique()
      .references(() => assets.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    targetAmount: money('target_amount').notNull(), // снимок на момент создания
    inflationRate: numeric('inflation_rate', { precision: 6, scale: 4 }).notNull(),
    termMonths: integer('term_months').notNull(),
    monthlyContribution: money('monthly_contribution').notNull(),
    // статусы вычисляются; вручную фиксируется только «потрачено»
    spentAt: date('spent_at'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('cap_goals_term_chk', sql`${t.termMonths} between 1 and 120`)],
);

export const capMovements = pgTable(
  'cap_movements',
  {
    id: id(),
    capGoalId: bigint('cap_goal_id', { mode: 'number' })
      .notNull()
      .references(() => capGoals.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    amount: money('amount').notNull(), // + пополнение цели, − списание
    source: text('source').notNull(),
    counterpartCapId: bigint('counterpart_cap_id', { mode: 'number' }).references(
      (): any => capGoals.id,
    ),
    transferGroup: uuid('transfer_group'),
    transactionId: bigint('transaction_id', { mode: 'number' }),
    note: text('note'),
  },
  (t) => [
    check(
      'cap_movements_source_chk',
      sql`${t.source} in ('own_funds','from_cap','to_cap','recalc','spend')`,
    ),
    check(
      'cap_movements_counterpart_chk',
      sql`(${t.source} in ('from_cap','to_cap')) = (${t.counterpartCapId} is not null)`,
    ),
    index('cap_movements_goal_idx').on(t.capGoalId, t.date),
  ],
);

// ------------------------------------------------------------------ фонд КС

export const fundCategories = pgTable('fund_categories', {
  id: id(),
  name: text('name').notNull().unique(),
  groupName: text('group_name').notNull().default('Прочее'),
  monthlyPlan: money('monthly_plan').notNull().default('0'),
  openingBalance: money('opening_balance').notNull().default('0'),
  sortOrder: integer('sort_order').notNull().default(0),
  activeFrom: date('active_from').notNull().default('2000-01-01'),
  activeTo: date('active_to'),
});

export const fundMovements = pgTable(
  'fund_movements',
  {
    id: id(),
    fundCategoryId: bigint('fund_category_id', { mode: 'number' })
      .notNull()
      .references(() => fundCategories.id),
    date: date('date').notNull(),
    amount: money('amount').notNull(), // + отложено, − израсходовано
    kind: text('kind').notNull(),
    // для компенсаций: from_account — снято со счёта КС; offset_next_topup — зачесть в след. пополнении
    settle: text('settle'),
    offsetAppliedAt: date('offset_applied_at'), // когда зачёт учтён в пополнении
    transactionId: bigint('transaction_id', { mode: 'number' }),
    note: text('note'),
  },
  (t) => [
    check(
      'fund_movements_kind_chk',
      sql`${t.kind} in ('plan_topup','extra_topup','reimbursement','adjustment')`,
    ),
    check(
      'fund_movements_settle_chk',
      sql`${t.settle} is null or ${t.settle} in ('from_account','offset_next_topup')`,
    ),
    index('fund_movements_cat_idx').on(t.fundCategoryId, t.date),
  ],
);

// ------------------------------------------------------------------ операции

export const transactions = pgTable(
  'transactions',
  {
    id: id(),
    date: date('date').notNull(),
    amount: money('amount').notNull(), // отрицательная = возврат/сторно
    currency: text('currency').notNull().default('RUB'),
    kind: text('kind').notNull(),
    categoryId: bigint('category_id', { mode: 'number' }).references(() => categories.id),
    accountId: bigint('account_id', { mode: 'number' }).references(() => accounts.id),
    counterAccountId: bigint('counter_account_id', { mode: 'number' }).references(
      () => accounts.id,
    ),
    incomeSourceId: bigint('income_source_id', { mode: 'number' }).references(
      () => incomeSources.id,
    ),
    assetId: bigint('asset_id', { mode: 'number' }).references(() => assets.id, {
      onDelete: 'set null',
    }),
    fundCategoryId: bigint('fund_category_id', { mode: 'number' }).references(
      () => fundCategories.id,
    ),
    // перевод, размещающий деньги фонда в другом инструменте (фонд не уменьшается)
    fundAllocation: text('fund_allocation'),
    // «что получено» для сбережений: «1 000 $», «монета Георгий Победоносец 7,78 г»
    acquiredNote: text('acquired_note'),
    // исходное выражение суммы («300+500-200») — редактируется как в Excel
    amountExpr: text('amount_expr'),
    // теневой расход: покрыт внешней компенсацией, в итоги расходов не входит (вопрос №22)
    covered: boolean('covered').notNull().default(false),
    // скрыто из таблиц месяца/года (переводы/сбережения); лента дня и балансы не меняются
    hidden: boolean('hidden').notNull().default(false),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'transactions_kind_chk',
      sql`${t.kind} in ('expense','purchase','income','transfer','saving','reimbursement','asset_resale','coverage_in')`,
    ),
    check('transactions_amount_chk', sql`${t.amount} <> 0`),
    check(
      'transactions_fund_allocation_chk',
      sql`${t.fundAllocation} is null or ${t.fundAllocation} in ('cap','ks')`,
    ),
    check(
      'transactions_transfer_chk',
      sql`${t.kind} <> 'transfer' or (${t.accountId} is not null and ${t.counterAccountId} is not null)`,
    ),
    index('transactions_date_idx').on(t.date),
    index('transactions_cat_date_idx').on(t.categoryId, t.date),
    index('transactions_account_idx').on(t.accountId, t.date),
    index('transactions_counter_idx').on(t.counterAccountId, t.date),
    index('transactions_asset_idx').on(t.assetId),
  ],
);

// ------------------------------------------------------------------- прочее

export const obligations = pgTable(
  'obligations',
  {
    id: id(),
    title: text('title').notNull(),
    amount: money('amount').notNull(),
    debtor: text('debtor').notNull().default('я'),
    creditor: text('creditor').notNull(),
    status: text('status').notNull().default('open'),
    openedAt: date('opened_at').notNull(),
    closedAt: date('closed_at'),
    note: text('note'),
  },
  (t) => [
    check('obligations_status_chk', sql`${t.status} in ('open','partially_paid','closed')`),
  ],
);

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
});
