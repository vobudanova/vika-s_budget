-- Переименование категорий вещей (и связанных категорий «Покупки → …»)
UPDATE asset_categories SET name = 'Одежда и аксессуары' WHERE name = 'Одежда';
UPDATE asset_categories SET name = 'Книги, блокноты, канцтовары' WHERE name = 'Книги';
UPDATE categories SET name = 'Одежда и аксессуары'
  WHERE name = 'Одежда' AND group_id = (SELECT id FROM category_groups WHERE name = 'Покупки');
UPDATE categories SET name = 'Книги, блокноты, канцтовары'
  WHERE name = 'Книги' AND group_id = (SELECT id FROM category_groups WHERE name = 'Покупки');
