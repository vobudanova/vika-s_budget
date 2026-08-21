'use client';

import { useRouter } from 'next/navigation';
import { ActionIcon, Button, Group } from '@mantine/core';
import { MonthPickerInput } from '@mantine/dates';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ymAdd } from '@/lib/dates';

export function MonthSwitcher({ ym, currentYm, base = '/month' }: { ym: string; currentYm: string; base?: string }) {
  const router = useRouter();
  return (
    <Group gap="xs" wrap="nowrap">
      <ActionIcon variant="default" onClick={() => router.push(`${base}/${ymAdd(ym, -1)}`)} aria-label="Предыдущий месяц">
        <IconChevronLeft size={16} />
      </ActionIcon>
      <MonthPickerInput
        value={`${ym}-01`}
        onChange={(v) => v && router.push(`${base}/${String(v).slice(0, 7)}`)}
        valueFormat="MMMM YYYY"
        w={170}
        popoverProps={{ shadow: 'md' }}
      />
      <ActionIcon variant="default" onClick={() => router.push(`${base}/${ymAdd(ym, 1)}`)} aria-label="Следующий месяц">
        <IconChevronRight size={16} />
      </ActionIcon>
      {ym !== currentYm && (
        <Button variant="subtle" size="compact-sm" onClick={() => router.push(`${base}/${currentYm}`)}>
          Текущий
        </Button>
      )}
    </Group>
  );
}
