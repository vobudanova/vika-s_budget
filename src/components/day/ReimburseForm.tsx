'use client';

import { useState, useTransition } from 'react';
import { Button, Group, Radio, Select, Stack, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createReimbursement } from '@/actions/fund';

export function ReimburseForm({
  date,
  fundCategories,
}: {
  date: string;
  fundCategories: { id: number; name: string; groupName: string }[];
}) {
  const [fundCategoryId, setFundCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [settle, setSettle] = useState<'from_account' | 'offset_next_topup'>('from_account');
  const [pending, startTransition] = useTransition();

  const groups = [...new Set(fundCategories.map((c) => c.groupName))];
  const data = groups.map((g) => ({
    group: g,
    items: fundCategories.filter((c) => c.groupName === g).map((c) => ({ value: String(c.id), label: c.name })),
  }));

  const submit = () =>
    startTransition(async () => {
      const res = await createReimbursement({
        date,
        fundCategoryId: Number(fundCategoryId),
        amount,
        settle,
        note: note || undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Компенсация записана' });
        setAmount('');
        setNote('');
      }
    });

  return (
    <Stack gap="sm">
      <Select
        label="Статья фонда"
        placeholder="Косметология"
        data={data}
        value={fundCategoryId}
        onChange={setFundCategoryId}
        searchable
      />
      <Group grow>
        <TextInput
          label="Сумма"
          placeholder="15 000"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
        />
        <TextInput
          label="Заметка"
          placeholder="косметолог"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
      </Group>
      <Radio.Group value={settle} onChange={(v) => setSettle(v as typeof settle)}>
        <Stack gap={6}>
          <Radio value="from_account" label="Снято со счёта КС сейчас" />
          <Radio value="offset_next_topup" label="Зачесть в следующем пополнении (счёт не трогаем)" />
        </Stack>
      </Radio.Group>
      <Group>
        <Button onClick={submit} loading={pending} disabled={!amount || !fundCategoryId}>
          Записать компенсацию
        </Button>
      </Group>
    </Stack>
  );
}
