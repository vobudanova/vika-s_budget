'use client';

import { useState, useTransition } from 'react';
import { Button, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createSaving } from '@/actions/transactions';

type Account = { id: number; name: string; type: string };

const INSTRUMENT_TYPES = ['metals', 'brokerage', 'deposit', 'cash'];

export function SavingForm({
  date,
  accounts,
  defaultAccountId,
}: {
  date: string;
  accounts: Account[];
  defaultAccountId: number | null;
}) {
  const [from, setFrom] = useState<string | null>(defaultAccountId ? String(defaultAccountId) : null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [acquired, setAcquired] = useState('');
  const [allocation, setAllocation] = useState(false);
  const [pending, startTransition] = useTransition();

  const fromAcc = accounts.find((a) => String(a.id) === from);
  const isFundSource = fromAcc?.type === 'savings_cap' || fromAcc?.type === 'savings_ks';
  const instruments = accounts.filter(
    (a) => INSTRUMENT_TYPES.includes(a.type) && String(a.id) !== from,
  );

  const submit = () =>
    startTransition(async () => {
      const res = await createSaving({
        date,
        amount,
        accountId: Number(from),
        counterAccountId: Number(to),
        acquiredNote: acquired || undefined,
        fundAllocation:
          allocation && isFundSource ? (fromAcc!.type === 'savings_cap' ? 'cap' : 'ks') : null,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Сбережение записано' });
        setAmount('');
        setAcquired('');
      }
    });

  return (
    <Stack gap="sm">
      <Group grow>
        <Select
          label="Откуда"
          data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
          value={from}
          onChange={setFrom}
          searchable
        />
        <Select
          label="Инструмент"
          placeholder="Доллары, металлы, вклад…"
          data={instruments.map((a) => ({ value: String(a.id), label: a.name }))}
          value={to}
          onChange={setTo}
          searchable
        />
      </Group>
      <Group grow>
        <TextInput
          label="Сумма"
          placeholder="85 000"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
        />
        <TextInput
          label="Что получено"
          placeholder="1 000 $ · монета 7,78 г"
          value={acquired}
          onChange={(e) => setAcquired(e.currentTarget.value)}
        />
      </Group>
      {isFundSource && (
        <Switch
          size="sm"
          label={`Размещение фонда ${fromAcc!.type === 'savings_cap' ? 'КАП' : 'КС'} — деньги остаются за фондом`}
          checked={allocation}
          onChange={(e) => setAllocation(e.currentTarget.checked)}
        />
      )}
      <Group>
        <Button onClick={submit} loading={pending} disabled={!amount || !from || !to}>
          Записать сбережение
        </Button>
      </Group>
    </Stack>
  );
}
