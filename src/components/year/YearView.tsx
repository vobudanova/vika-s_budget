'use client';

import { useTransition } from 'react';
import { Alert, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { YearSheet } from '@/queries/year';
import { RU_MONTHS } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
import { deleteCategoryHard } from '@/actions/reference';
import { SheetTable, type SheetColumn } from '@/components/sheet/SheetTable';

export function YearView({ data }: { data: YearSheet }) {
  const [, startTransition] = useTransition();

  const columns: SheetColumn[] = Array.from({ length: 12 }, (_, i) => ({
    key: i + 1,
    label: RU_MONTHS[i].slice(0, 3),
  }));

  // Корзинка окончательного удаления — только у обнулённых помеченных категорий
  const sections = data.sections.map((s) => ({
    ...s,
    rows: s.rows.map((r) =>
      r.pendingDelete
        ? {
            ...r,
            onDelete: () =>
              startTransition(async () => {
                if (!confirm(`Навсегда удалить категорию «${r.name}»? Она исчезнет отовсюду.`)) return;
                const res = await deleteCategoryHard(Number(r.key));
                notifications.show(
                  res.ok
                    ? { message: `Категория «${r.name}» удалена` }
                    : { color: 'red', message: res.error },
                );
              }),
          }
        : r,
    ),
  }));

  // Доходы живут на своей странице; здесь — только сводка расходов

  return (
    <Stack gap="md">
      {data.pendingWarnings.filter((w) => w.months.length > 0).length > 0 && (
        <Alert color="red" variant="light" radius="lg" title="Категории, помеченные к удалению, ещё содержат данные">
          <Stack gap={4}>
            {data.pendingWarnings
              .filter((w) => w.months.length > 0)
              .map((w) => (
                <Text key={w.name} fz="sm">
                  «{w.groupName} → {w.name}»: {fmtMoney(w.total)} в месяцах {w.months.join(', ')}.
                  Перенесите записи — корзинка появится, когда всё обнулится.
                </Text>
              ))}
          </Stack>
        </Alert>
      )}

      <SheetTable
        columns={columns}
        sections={sections}
        topRows={[
          { label: 'Начисленные', total: data.accruedTotal, values: data.accruedTotals },
          { label: 'Фактические', total: data.actualTotal, values: data.actualTotals, muted: true },
        ]}
        minWidth={1180}
        firstColWidth={240}
      />

      <Text fz="xs" c="dimmed">
        Компенсировано из КС за год: {fmtMoney(data.ksReimbursedYear)} · теневые расходы:{' '}
        {fmtMoney(data.coveredYear)} — в итоги расходов не входят.
      </Text>
    </Stack>
  );
}
