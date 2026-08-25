-- Итог баланса: только дебетовые, накопительные и рублёвые вклады.
-- Кредитка, брокерские, металлы, валюта, наличные и выданные долги — вне итога
-- (признак редактируется в настройках счетов).
UPDATE accounts SET include_in_total =
  (type IN ('checking', 'savings_cap', 'savings_ks', 'deposit') AND currency = 'RUB');
