-- Тип счёта «Выданные долги»: деньги, отданные в долг, остаются активом
ALTER TABLE accounts DROP CONSTRAINT accounts_type_chk;
--> statement-breakpoint
ALTER TABLE accounts ADD CONSTRAINT accounts_type_chk
  CHECK (type IN ('checking','credit_card','savings_cap','savings_ks','deposit','cash','metals','brokerage','receivable'));
--> statement-breakpoint
INSERT INTO accounts (name, type, sort_order)
  VALUES ('Выданные долги', 'receivable', 10)
  ON CONFLICT (name) DO NOTHING;
