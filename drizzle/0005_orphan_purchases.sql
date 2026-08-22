-- Покупки всегда участвуют в «Фактических»: v_expenses_actual связывает
-- транзакцию с категорией «Покупки → <категория актива>». Если подкатегории
-- не было, покупка создавалась без category_id и выпадала из расходов.
-- Досоздаём группу/подкатегории и привязываем осиротевшие покупки.

INSERT INTO category_groups (name, sort_order)
SELECT 'Покупки', 60
WHERE NOT EXISTS (SELECT 1 FROM category_groups WHERE name = 'Покупки');
--> statement-breakpoint

INSERT INTO categories (group_id, name, sort_order, active_from)
SELECT g.id, ac.name, 99, DATE '2020-01-01'
FROM asset_categories ac
JOIN category_groups g ON g.name = 'Покупки'
WHERE NOT EXISTS (
  SELECT 1 FROM categories c WHERE c.group_id = g.id AND c.name = ac.name
);
--> statement-breakpoint

UPDATE transactions t
SET category_id = c.id
FROM assets a
JOIN asset_categories ac ON ac.id = a.asset_category_id
JOIN category_groups g ON g.name = 'Покупки'
JOIN categories c ON c.group_id = g.id AND c.name = ac.name
WHERE t.asset_id = a.id
  AND t.kind = 'purchase'
  AND t.category_id IS NULL;
