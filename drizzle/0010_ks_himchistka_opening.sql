-- Data-fix: остаток «Химчистки» с прошлых лет должен быть 17 579,00.
-- При импорте компенсация «ателье» (−600, 18.03.2025) уже была учтена в
-- opening_balance и продублировалась движением фонда: страница КС показывала
-- 17 579 − 600 = 16 979. Поднимаем opening на 600, движение и операцию в
-- листе марта-2025 не трогаем. Guard по значению и наличию дубля — идемпотентно
-- и no-op на базах без этого движения.
UPDATE fund_categories fc
SET opening_balance = 18179.00
WHERE fc.name = 'Химчистка' AND fc.opening_balance = 17579.00
  AND EXISTS (
    SELECT 1 FROM fund_movements fm
    WHERE fm.fund_category_id = fc.id AND fm.date < '2026-01-01' AND fm.amount = -600.00
  );
