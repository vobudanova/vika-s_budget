-- Пометка категории «к удалению» (окончательное удаление — когда данных не осталось)
ALTER TABLE categories ADD COLUMN pending_delete boolean NOT NULL DEFAULT false;
--> statement-breakpoint
-- Исходное выражение суммы («300+500-200») — показывается при редактировании как в Excel
ALTER TABLE transactions ADD COLUMN amount_expr text;
--> statement-breakpoint
-- Дни, отмеченные как «заполненные» (подсветка в матрице месяца)
CREATE TABLE filled_days (date date PRIMARY KEY);
