-- Удаление цели КАП с историей перетоков: у движений НА другие цели
-- counterpart_cap_id указывает на удаляемую цель. FK переводится на
-- ON DELETE SET NULL, а check ослабляется: counterpart допустим только у
-- перетоков, но у осиротевших строк может быть NULL (имя цели остаётся в note).
ALTER TABLE cap_movements DROP CONSTRAINT IF EXISTS cap_movements_counterpart_cap_id_cap_goals_id_fk;
ALTER TABLE cap_movements ADD CONSTRAINT cap_movements_counterpart_cap_id_cap_goals_id_fk
  FOREIGN KEY (counterpart_cap_id) REFERENCES cap_goals(id) ON DELETE SET NULL;

ALTER TABLE cap_movements DROP CONSTRAINT IF EXISTS cap_movements_counterpart_chk;
ALTER TABLE cap_movements ADD CONSTRAINT cap_movements_counterpart_chk
  CHECK (counterpart_cap_id IS NULL OR source IN ('from_cap', 'to_cap'));
