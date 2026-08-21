'use client';

import { useState, useTransition } from 'react';
import { Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { createCompensation, createIncome } from '@/actions/transactions';
import { CardLabel } from '@/components/CardLabel';
import { todayLocalISO } from '@/components/assets/today';
import type { SelectGroup } from '@/components/tx-helpers';

export function IncomeForm({
  sources,
  accounts,
  defaultAccountId,
}: {
  sources: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
}) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string>(todayLocalISO());
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await createIncome({
        date,
        amount,
        incomeSourceId: Number(sourceId),
        counterAccountId: Number(accountId),
        note: note || undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Доход записан' });
        setAmount('');
        setNote('');
      }
    });

  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Новый доход</CardLabel>
        <Group grow>
          <Select
            label="Источник"
            data={sources.map((s) => ({ value: String(s.id), label: s.name }))}
            value={sourceId}
            onChange={setSourceId}
            searchable
            placeholder="Аренда, платёж…"
          />
          <DatePickerInput label="Дата" value={date} onChange={(v) => v && setDate(String(v))} valueFormat="D MMM YYYY" />
        </Group>
        <Group grow>
          <TextInput
            label="Сумма"
            placeholder="150 000"
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
            className="money"
            inputMode="decimal"
          />
          <Select
            label="Счёт зачисления"
            data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            value={accountId}
            onChange={setAccountId}
          />
        </Group>
        <TextInput label="Заметка" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group>
          <Button onClick={submit} loading={pending} disabled={!amount || !sourceId || !accountId}>
            Записать доход
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function CompensationForm({
  categories,
  accounts,
  compensationSourceId,
  defaultAccountId,
}: {
  categories: SelectGroup[];
  accounts: { id: number; name: string }[];
  compensationSourceId: number | null;
  defaultAccountId: number | null;
}) {
  const [spent, setSpent] = useState('');
  const [received, setReceived] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      if (!compensationSourceId) {
        notifications.show({ color: 'red', message: 'Источник «Компенсации» не найден' });
        return;
      }
      const res = await createCompensation({
        date: todayLocalISO(),
        spentAmount: spent,
        receivedAmount: received,
        categoryId: Number(categoryId),
        accountId: Number(accountId),
        counterAccountId: Number(accountId),
        incomeSourceId: compensationSourceId,
        note: note || undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Компенсация записана: трата стала теневой' });
        setSpent('');
        setReceived('');
        setNote('');
      }
    });

  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Компенсация (теневая трата)</CardLabel>
        <Text fz="xs" c="dimmed">
          Получено больше, чем потрачено: трата не попадает в расходы, остаток — в доход
          «Компенсации».
        </Text>
        <Group grow>
          <TextInput
            label="Потрачено"
            placeholder="10 000"
            value={spent}
            onChange={(e) => setSpent(e.currentTarget.value)}
            className="money"
            inputMode="decimal"
          />
          <TextInput
            label="Получено"
            placeholder="12 000"
            value={received}
            onChange={(e) => setReceived(e.currentTarget.value)}
            className="money"
            inputMode="decimal"
          />
        </Group>
        <Group grow>
          <Select
            label="Категория траты"
            data={categories}
            value={categoryId}
            onChange={setCategoryId}
            searchable
          />
          <Select
            label="Счёт"
            data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            value={accountId}
            onChange={setAccountId}
          />
        </Group>
        <TextInput label="Заметка" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group>
          <Button
            variant="light"
            onClick={submit}
            loading={pending}
            disabled={!spent || !received || !categoryId}
          >
            Записать компенсацию
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
