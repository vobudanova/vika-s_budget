'use client';

import { useState, useTransition } from 'react';
import {
  Button,
  Chip,
  Group,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createTransfer } from '@/actions/transactions';
import { lendMoney } from '@/actions/misc';

type Account = { id: number; name: string; type: string };

export function TransferForm({
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
  const [note, setNote] = useState('');
  const [lend, setLend] = useState(false);
  const [toWhom, setToWhom] = useState('');
  const [allocation, setAllocation] = useState(false);
  const [pending, startTransition] = useTransition();

  const data = accounts.map((a) => ({ value: String(a.id), label: a.name }));
  const byType = (t: string) => accounts.find((a) => a.type === t);
  const fromAcc = accounts.find((a) => String(a.id) === from);
  const isFundSource = fromAcc?.type === 'savings_cap' || fromAcc?.type === 'savings_ks';

  const preset = (targetType: string) => {
    const acc = byType(targetType);
    if (acc) setTo(String(acc.id));
    setLend(false);
  };

  const submit = () =>
    startTransition(async () => {
      const res = lend
        ? await lendMoney({ date, amount, fromAccountId: Number(from), toWhom, note: note || undefined })
        : await createTransfer({
            date,
            amount,
            accountId: Number(from),
            counterAccountId: Number(to),
            fundAllocation: allocation && isFundSource ? (fromAcc!.type === 'savings_cap' ? 'cap' : 'ks') : null,
            note: note || undefined,
          });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: lend ? 'Долг записан' : 'Перевод сохранён' });
        setAmount('');
        setNote('');
        setToWhom('');
      }
    });

  return (
    <Stack gap="sm">
      <Group gap={6}>
        <Chip checked={false} onClick={() => preset('savings_ks')} size="xs" variant="light">
          На КС
        </Chip>
        <Chip checked={false} onClick={() => preset('savings_cap')} size="xs" variant="light">
          На КАП
        </Chip>
        <Chip checked={false} onClick={() => preset('cash')} size="xs" variant="light">
          Снятие наличных
        </Chip>
        <Chip checked={lend} onClick={() => setLend(!lend)} size="xs" variant="light" color="orange">
          В долг
        </Chip>
      </Group>
      <Group grow>
        <Select label="Откуда" data={data} value={from} onChange={setFrom} searchable />
        {lend ? (
          <TextInput
            label="Кому"
            placeholder="Имя"
            value={toWhom}
            onChange={(e) => setToWhom(e.currentTarget.value)}
          />
        ) : (
          <Select label="Куда" data={data} value={to} onChange={setTo} searchable placeholder="Счёт" />
        )}
      </Group>
      <Group grow>
        <TextInput
          label="Сумма"
          placeholder="45 200"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
        />
        <TextInput label="Заметка" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      </Group>
      {isFundSource && !lend && (
        <Switch
          size="sm"
          label={`Размещение фонда ${fromAcc!.type === 'savings_cap' ? 'КАП' : 'КС'} — деньги остаются за фондом`}
          checked={allocation}
          onChange={(e) => setAllocation(e.currentTarget.checked)}
        />
      )}
      <Group>
        <Button onClick={submit} loading={pending} disabled={!amount || !from || (!to && !lend) || (lend && !toWhom)}>
          {lend ? 'Дать в долг' : 'Перевести'}
        </Button>
      </Group>
    </Stack>
  );
}
