-- Снапшот = фактическая сумма на счёте на конец дня on_date.
-- Операции задним числом (в т.ч. за сам день сверки) баланс не меняют —
-- влияют только операции строго ПОСЛЕ дня снапшота.
CREATE OR REPLACE VIEW v_account_balances AS
SELECT
  a.id AS account_id,
  a.name,
  a.type,
  a.currency,
  a.include_in_total,
  a.sort_order,
  s.on_date AS last_snapshot_date,
  COALESCE(s.balance, 0)
    + COALESCE(inflow.sum, 0)
    - COALESCE(outflow.sum, 0) AS balance
FROM accounts a
LEFT JOIN LATERAL (
  SELECT balance, on_date
  FROM account_snapshots
  WHERE account_id = a.id
  ORDER BY on_date DESC
  LIMIT 1
) s ON true
LEFT JOIN LATERAL (
  SELECT sum(amount) AS sum
  FROM transactions t
  WHERE t.counter_account_id = a.id
    AND t.date > COALESCE(s.on_date, DATE '1899-12-31')
) inflow ON true
LEFT JOIN LATERAL (
  SELECT sum(amount) AS sum
  FROM transactions t
  WHERE t.account_id = a.id
    AND t.date > COALESCE(s.on_date, DATE '1899-12-31')
) outflow ON true
WHERE a.is_active;
