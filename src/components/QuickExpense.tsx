'use client';

import { useRef, useState, useTransition } from 'react';
import { Button, Group, Select, Stack, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createExpense } from '@/actions/transactions';
import type { SelectGroup } from './tx-helpers';

export function QuickExpense({
  date,
  categories,
  defaultAccountId,
  defaultCategoryId,
  compact = false,
}: {
  date: string;
  categories: SelectGroup[];
  defaultAccountId: number | null;
  defaultCategoryId?: number | null;
  compact?: boolean;
}) {
  const [categoryId, setCategoryId] = useState<string | null>(
    defaultCategoryId ? String(defaultCategoryId) : null,
  );
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();
  const amountRef = useRef<HTMLInputElement>(null);

  const submit = (refund: boolean) =>
    startTransition(async () => {
      if (!categoryId) {
        notifications.show({ color: 'red', message: 'Выберите категорию' });
        return;
      }
      const res = await createExpense({
        date,
        amount,
        categoryId: Number(categoryId),
        accountId: defaultAccountId,
        note: note || undefined,
        refund,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        setAmount('');
        setNote('');
        amountRef.current?.focus();
      }
    });

  return (
    <Stack gap="xs">
      <Select
        label={compact ? undefined : 'Категория'}
        placeholder="Категория"
        data={categories}
        value={categoryId}
        onChange={setCategoryId}
        searchable
        nothingFoundMessage="Не найдено"
        comboboxProps={{ shadow: 'md' }}
      />
      <Group gap="xs" grow preventGrowOverflow={false} wrap="nowrap">
        <TextInput
          ref={amountRef}
          placeholder="Сумма: 850 или 100+200"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(false);
          }}
          style={{ flex: 1.2 }}
        />
        <TextInput
          placeholder="Заметка"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit(false);
          }}
          style={{ flex: 1 }}
        />
      </Group>
      <Group gap="xs">
        <Button onClick={() => submit(false)} loading={pending}>
          Добавить
        </Button>
        <Button variant="light" color="gray" onClick={() => submit(true)} disabled={pending}>
          Возврат
        </Button>
      </Group>
    </Stack>
  );
}
