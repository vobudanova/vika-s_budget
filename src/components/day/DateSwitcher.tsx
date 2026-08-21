'use client';

import { useRouter } from 'next/navigation';
import { ActionIcon, Button, Group } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { addMonthsClamped } from '@/lib/dates';

function shiftDay(iso: string, delta: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function DateSwitcher({
  date,
  base,
  today,
}: {
  date: string;
  base: string; // /day или /month
  today: string;
}) {
  const router = useRouter();
  void addMonthsClamped;

  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon
        variant="default"
        onClick={() => router.push(`${base}/${shiftDay(date, -1)}`)}
        aria-label="Предыдущий день"
      >
        <IconChevronLeft size={16} />
      </ActionIcon>
      <DatePickerInput
        value={date}
        onChange={(v) => v && router.push(`${base}/${v}`)}
        valueFormat="D MMMM YYYY"
        w={180}
        popoverProps={{ shadow: 'md' }}
      />
      <ActionIcon
        variant="default"
        onClick={() => router.push(`${base}/${shiftDay(date, 1)}`)}
        aria-label="Следующий день"
      >
        <IconChevronRight size={16} />
      </ActionIcon>
      {date !== today && (
        <Button variant="subtle" size="compact-sm" onClick={() => router.push(`${base}/${today}`)}>
          Сегодня
        </Button>
      )}
    </Group>
  );
}
