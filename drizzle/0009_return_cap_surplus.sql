-- Возврат излишка перераспределения: при закрытии «Учебник "Машиностроительное
-- черчение"» в «Красный Moleskine» ушло 1 220,16 при потребности 829,44.
-- Излишек 390,72 возвращается обратно. Выполняется один раз и только там,
-- где существует исходный переток (прод).
WITH mol AS (SELECT id FROM cap_goals WHERE name = 'Красный Moleskine' LIMIT 1),
     uch AS (SELECT id FROM cap_goals WHERE name = 'Учебник "Машиностроительное черчение"' LIMIT 1),
     grp AS (SELECT gen_random_uuid() AS g)
INSERT INTO cap_movements (cap_goal_id, date, amount, source, counterpart_cap_id, transfer_group, note)
SELECT v.goal, DATE '2026-08-25', v.amount, v.source, v.counterpart, grp.g, v.note
FROM grp,
LATERAL (VALUES
  ((SELECT id FROM mol), -390.72::numeric, 'to_cap',   (SELECT id FROM uch), 'возврат излишка перераспределения'),
  ((SELECT id FROM uch),  390.72::numeric, 'from_cap', (SELECT id FROM mol), 'возврат излишка из «Красный Moleskine»')
) AS v(goal, amount, source, counterpart, note)
WHERE (SELECT id FROM mol) IS NOT NULL
  AND (SELECT id FROM uch) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM cap_movements m
    WHERE m.cap_goal_id = (SELECT id FROM mol) AND m.source = 'from_cap'
      AND m.date = DATE '2026-08-25' AND m.amount = 1220.16
  )
  AND NOT EXISTS (
    SELECT 1 FROM cap_movements WHERE note = 'возврат излишка перераспределения'
  );
