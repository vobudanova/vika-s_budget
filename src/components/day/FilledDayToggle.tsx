'use client';

import { useState, useTransition } from 'react';
import { Checkbox } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { toggleFilledDay } from '@/actions/misc';

/** «Отметить день заполненным» — подсвечивает колонку дня в матрице месяца. */
export function FilledDayToggle({ date, initial }: { date: string; initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    setChecked(next);
    startTransition(async () => {
      const res = await toggleFilledDay(date, next);
      if (!res.ok) {
        setChecked(!next);
        notifications.show({ color: 'red', message: res.error });
      }
    });
  };

  return (
    <Checkbox
      label="День заполнен"
      checked={checked}
      onChange={(e) => toggle(e.currentTarget.checked)}
      disabled={pending}
      size="sm"
    />
  );
}
