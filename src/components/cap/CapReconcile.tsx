'use client';

import { useState, useTransition } from 'react';
import { ActionIcon, Button, Group, Text, TextInput, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { saveSetting } from '@/actions/misc';
import { Money } from '@/components/Money';
import { parseAmountExpr } from '@/lib/money';

/** Редактируемая строка «Размещения фонда»: значение хранится в настройках. */
export function AllocationsValue({ value }: { value: number }) {
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const n = parseAmountExpr(input);
      if (n === null || n < 0) {
        notifications.show({ color: 'red', message: 'Некорректная сумма' });
        return;
      }
      const res = await saveSetting('cap_allocations', n);
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
      else setEditing(false);
    });

  if (editing)
    return (
      <Group gap={6} wrap="nowrap" justify="flex-end">
        <TextInput
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          size="xs"
          w={110}
          className="money"
          inputMode="decimal"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
        <Button size="compact-xs" onClick={save} loading={pending}>
          ОК
        </Button>
      </Group>
    );

  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      <Money value={value} fz="sm" exact />
      <Tooltip label="Изменить сумму размещений">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => {
            setInput(value ? String(value).replace('.', ',') : '');
            setEditing(true);
          }}
        >
          <IconPencil size={13} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
