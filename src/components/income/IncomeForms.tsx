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
  bare = false,
}: {
  sources: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
  /** без карточки и заголовка — для шторки */
  bare?: boolean;
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

  const body = (
      <Stack gap="sm">
        {!bare && <CardLabel>Новый доход</CardLabel>}
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
  );
  return bare ? body : <Card>{body}</Card>;
}

export function CompensationForm({
  categories,
  accounts,
  compensationSourceId,
  defaultAccountId,
  bare = false,
}: {
  categories: SelectGroup[];
  accounts: { id: number; name: string }[];
  compensationSourceId: number | null;
  defaultAccountId: number | null;
  bare?: boolean;
}) {
  const [spent, setSpent] = useState('');
  const [received, setReceived] = useState('');
  const [date, setDate] = useState<string>(todayLocalISO());
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
        date,
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

  const body = (
      <Stack gap="sm">
        {!bare && <CardLabel>Компенсация (теневая трата)</CardLabel>}
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
        <Select
          label="Категория траты"
          data={categories}
          value={categoryId}
          onChange={setCategoryId}
          searchable
        />
        <Group grow>
          <DatePickerInput
            label="Дата"
            value={date}
            onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
            valueFormat="D MMM YYYY"
            popoverProps={{ shadow: 'md' }}
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
  );
  return bare ? body : <Card>{body}</Card>;
}
