-- Балансы счетов: последний сверочный снапшот + дельта операций после него.
-- Приход: counter_account_id = счёт. Расход: account_id = счёт.
CREATE VIEW v_account_balances AS
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
    AND t.date >= COALESCE(s.on_date, DATE '1900-01-01')
) inflow ON true
LEFT JOIN LATERAL (
  SELECT sum(amount) AS sum
  FROM transactions t
  WHERE t.account_id = a.id
    AND t.date >= COALESCE(s.on_date, DATE '1900-01-01')
) outflow ON true
WHERE a.is_active;
--> statement-breakpoint

-- «Фактические» расходы: траты + покупки полной суммой.
-- Компенсации из КС и теневые (covered) расходы не входят.
CREATE VIEW v_expenses_actual AS
SELECT t.id, t.date, t.category_id, c.group_id, c.row_type, t.amount, t.note, t.kind AS src
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.kind IN ('expense', 'purchase') AND NOT t.covered;
--> statement-breakpoint

-- «Начисленные» расходы: траты + амортизационные начисления вместо покупок.
CREATE VIEW v_expenses_accrued AS
SELECT t.id, t.date, t.category_id, c.group_id, c.row_type, t.amount, t.note, 'expense' AS src
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE t.kind = 'expense' AND NOT t.covered
UNION ALL
SELECT
  aa.id,
  aa.accrual_date AS date,
  ac.expense_category_id AS category_id,
  c.group_id,
  c.row_type,
  aa.amount,
  a.name AS note,
  'amortization' AS src
FROM amortization_accruals aa
JOIN assets a ON a.id = aa.asset_id
JOIN asset_categories ac ON ac.id = a.asset_category_id
JOIN categories c ON c.id = ac.expense_category_id;
