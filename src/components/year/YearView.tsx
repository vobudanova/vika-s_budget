'use client';

import { useState, useTransition } from 'react';
import { Alert, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { YearSheet } from '@/queries/year';
import { RU_MONTHS } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
import { deleteCategoryHard } from '@/actions/reference';
import { SheetTable, type CellClick, type SheetColumn } from '@/components/sheet/SheetTable';
import { CellBreakdownDrawer, type CellQuery } from '@/components/sheet/CellBreakdown';
import { confirmDanger } from '@/lib/confirm';

export function YearView({ data, year }: { data: YearSheet; year: number }) {
  const [, startTransition] = useTransition();
  const [cell, setCell] = useState<{ q: CellQuery; title: string } | null>(null);

  const onCell = ({ section, row, col, rowTitle }: CellClick) => {
    const q: CellQuery =
      col === 'total'
        ? { from: `${year}-01-01`, to: `${year}-12-31`, section, row }
        : {
            from: `${year}-${String(col).padStart(2, '0')}-01`,
            to: `${year}-${String(col).padStart(2, '0')}-${new Date(year, col, 0).getDate()}`,
            section,
            row,
          };
    setCell({
      q,
      title: `${rowTitle} · ${col === 'total' ? year : `${RU_MONTHS[col - 1].toLowerCase()} ${year}`}`,
    });
  };

  const columns: SheetColumn[] = Array.from({ length: 12 }, (_, i) => {
    const daysInMonth = new Date(year, i + 1, 0).getDate();
    return {
      key: i + 1,
      label: RU_MONTHS[i].slice(0, 3),
      // месяц подсвечен, когда «день заполнен» отмечен на каждом его дне
      highlight: data.filledMonths[i + 1] >= daysInMonth,
    };
  });

  // Корзинка окончательного удаления — только у обнулённых помеченных категорий
  const sections = data.sections.map((s) => ({
    ...s,
    rows: s.rows.map((r) =>
      r.pendingDelete
        ? {
            ...r,
            onDelete: () =>
              confirmDanger({
                title: 'Удалить категорию',
                message: `Навсегда удалить категорию «${r.name}»? Она исчезнет отовсюду.`,
                onConfirm: () =>
                  startTransition(async () => {
                    const res = await deleteCategoryHard(Number(r.key));
                    notifications.show(
                      res.ok
                        ? { message: `Категория «${r.name}» удалена` }
                        : { color: 'red', message: res.error },
                    );
                  }),
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
          {
            label: 'Начисленные',
            total: data.accruedTotal,
            values: data.accruedTotals,
            cellKey: 'top-accrued',
          },
          {
            label: 'Фактические',
            total: data.actualTotal,
            values: data.actualTotals,
            muted: true,
            cellKey: 'top-actual',
          },
        ]}
        minWidth={1180}
        firstColWidth={240}
        onCell={onCell}
      />
      <CellBreakdownDrawer
        query={cell?.q ?? null}
        title={cell?.title ?? ''}
        onClose={() => setCell(null)}
      />
    </Stack>
  );
}
