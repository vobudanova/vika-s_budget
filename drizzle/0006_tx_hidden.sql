-- Ручное скрытие операции из таблиц месяца/года (лента дня и балансы не трогаются)
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "hidden" boolean NOT NULL DEFAULT false;
