CREATE TABLE "account_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "account_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"account_id" bigint NOT NULL,
	"on_date" date NOT NULL,
	"balance" numeric(14, 2) NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" text NOT NULL,
	"deposit_kind" text,
	"source_account_id" bigint,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"include_in_total" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"note" text,
	CONSTRAINT "accounts_name_unique" UNIQUE("name"),
	CONSTRAINT "accounts_type_chk" CHECK ("accounts"."type" in ('checking','credit_card','savings_cap','savings_ks','deposit','cash','metals','brokerage')),
	CONSTRAINT "accounts_currency_chk" CHECK ("accounts"."currency" in ('RUB','USD')),
	CONSTRAINT "accounts_deposit_kind_chk" CHECK ("accounts"."deposit_kind" is null or "accounts"."deposit_kind" in ('long_term','interest'))
);
--> statement-breakpoint
CREATE TABLE "amortization_accruals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "amortization_accruals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"asset_id" bigint NOT NULL,
	"seq_no" integer NOT NULL,
	"accrual_date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "asset_adjustments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_adjustments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"asset_id" bigint NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "asset_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"expense_category_id" bigint,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "asset_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "assets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"asset_category_id" bigint NOT NULL,
	"purchase_date" date NOT NULL,
	"initial_price" numeric(14, 2) NOT NULL,
	"term_months" integer NOT NULL,
	"disposed_at" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assets_term_chk" CHECK ("assets"."term_months" between 1 and 120),
	CONSTRAINT "assets_price_chk" CHECK ("assets"."initial_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "cap_goals" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cap_goals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"asset_id" bigint,
	"name" text NOT NULL,
	"target_amount" numeric(14, 2) NOT NULL,
	"inflation_rate" numeric(6, 4) NOT NULL,
	"term_months" integer NOT NULL,
	"monthly_contribution" numeric(14, 2) NOT NULL,
	"spent_at" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cap_goals_asset_id_unique" UNIQUE("asset_id"),
	CONSTRAINT "cap_goals_term_chk" CHECK ("cap_goals"."term_months" between 1 and 120)
);
--> statement-breakpoint
CREATE TABLE "cap_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "cap_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"cap_goal_id" bigint NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"source" text NOT NULL,
	"counterpart_cap_id" bigint,
	"transfer_group" uuid,
	"transaction_id" bigint,
	"note" text,
	CONSTRAINT "cap_movements_source_chk" CHECK ("cap_movements"."source" in ('own_funds','from_cap','to_cap','recalc','spend')),
	CONSTRAINT "cap_movements_counterpart_chk" CHECK (("cap_movements"."source" in ('from_cap','to_cap')) = ("cap_movements"."counterpart_cap_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"group_id" bigint NOT NULL,
	"name" text NOT NULL,
	"row_type" text DEFAULT 'expense' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active_from" date DEFAULT '2000-01-01' NOT NULL,
	"active_to" date,
	CONSTRAINT "categories_row_type_chk" CHECK ("categories"."row_type" in ('expense','trip'))
);
--> statement-breakpoint
CREATE TABLE "category_groups" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "category_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active_from" date DEFAULT '2000-01-01' NOT NULL,
	"active_to" date,
	CONSTRAINT "category_groups_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fund_categories" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fund_categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"group_name" text DEFAULT 'Прочее' NOT NULL,
	"monthly_plan" numeric(14, 2) DEFAULT '0' NOT NULL,
	"opening_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active_from" date DEFAULT '2000-01-01' NOT NULL,
	"active_to" date,
	CONSTRAINT "fund_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "fund_movements" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "fund_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"fund_category_id" bigint NOT NULL,
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"kind" text NOT NULL,
	"settle" text,
	"offset_applied_at" date,
	"transaction_id" bigint,
	"note" text,
	CONSTRAINT "fund_movements_kind_chk" CHECK ("fund_movements"."kind" in ('plan_topup','extra_topup','reimbursement','adjustment')),
	CONSTRAINT "fund_movements_settle_chk" CHECK ("fund_movements"."settle" is null or "fund_movements"."settle" in ('from_account','offset_next_topup'))
);
--> statement-breakpoint
CREATE TABLE "income_sources" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "income_sources_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"type" text NOT NULL,
	"expected_monthly" numeric(14, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "income_sources_name_unique" UNIQUE("name"),
	CONSTRAINT "income_sources_type_chk" CHECK ("income_sources"."type" in ('rent','one_off','interest_cashback','monthly_payment','cash_income','compensation'))
);
--> statement-breakpoint
CREATE TABLE "obligations" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "obligations_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"debtor" text DEFAULT 'я' NOT NULL,
	"creditor" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"opened_at" date NOT NULL,
	"closed_at" date,
	"note" text,
	CONSTRAINT "obligations_status_chk" CHECK ("obligations"."status" in ('open','partially_paid','closed'))
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'RUB' NOT NULL,
	"kind" text NOT NULL,
	"category_id" bigint,
	"account_id" bigint,
	"counter_account_id" bigint,
	"income_source_id" bigint,
	"asset_id" bigint,
	"fund_category_id" bigint,
	"fund_allocation" text,
	"acquired_note" text,
	"covered" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_kind_chk" CHECK ("transactions"."kind" in ('expense','purchase','income','transfer','saving','reimbursement','asset_resale','coverage_in')),
	CONSTRAINT "transactions_amount_chk" CHECK ("transactions"."amount" <> 0),
	CONSTRAINT "transactions_fund_allocation_chk" CHECK ("transactions"."fund_allocation" is null or "transactions"."fund_allocation" in ('cap','ks')),
	CONSTRAINT "transactions_transfer_chk" CHECK ("transactions"."kind" <> 'transfer' or ("transactions"."account_id" is not null and "transactions"."counter_account_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "account_snapshots" ADD CONSTRAINT "account_snapshots_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amortization_accruals" ADD CONSTRAINT "amortization_accruals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_adjustments" ADD CONSTRAINT "asset_adjustments_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_expense_category_id_categories_id_fk" FOREIGN KEY ("expense_category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_asset_category_id_asset_categories_id_fk" FOREIGN KEY ("asset_category_id") REFERENCES "public"."asset_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_goals" ADD CONSTRAINT "cap_goals_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_movements" ADD CONSTRAINT "cap_movements_cap_goal_id_cap_goals_id_fk" FOREIGN KEY ("cap_goal_id") REFERENCES "public"."cap_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cap_movements" ADD CONSTRAINT "cap_movements_counterpart_cap_id_cap_goals_id_fk" FOREIGN KEY ("counterpart_cap_id") REFERENCES "public"."cap_goals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_group_id_category_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."category_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fund_movements" ADD CONSTRAINT "fund_movements_fund_category_id_fund_categories_id_fk" FOREIGN KEY ("fund_category_id") REFERENCES "public"."fund_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counter_account_id_accounts_id_fk" FOREIGN KEY ("counter_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_income_source_id_income_sources_id_fk" FOREIGN KEY ("income_source_id") REFERENCES "public"."income_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_fund_category_id_fund_categories_id_fk" FOREIGN KEY ("fund_category_id") REFERENCES "public"."fund_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_snapshots_uq" ON "account_snapshots" USING btree ("account_id","on_date");--> statement-breakpoint
CREATE UNIQUE INDEX "amortization_accruals_uq" ON "amortization_accruals" USING btree ("asset_id","seq_no");--> statement-breakpoint
CREATE INDEX "amortization_accruals_date_idx" ON "amortization_accruals" USING btree ("accrual_date");--> statement-breakpoint
CREATE INDEX "asset_adjustments_asset_idx" ON "asset_adjustments" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "assets_category_idx" ON "assets" USING btree ("asset_category_id");--> statement-breakpoint
CREATE INDEX "cap_movements_goal_idx" ON "cap_movements" USING btree ("cap_goal_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_group_name_uq" ON "categories" USING btree ("group_id","name");--> statement-breakpoint
CREATE INDEX "fund_movements_cat_idx" ON "fund_movements" USING btree ("fund_category_id","date");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_cat_date_idx" ON "transactions" USING btree ("category_id","date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "transactions_counter_idx" ON "transactions" USING btree ("counter_account_id","date");--> statement-breakpoint
CREATE INDEX "transactions_asset_idx" ON "transactions" USING btree ("asset_id");