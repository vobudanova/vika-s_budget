'use client';

import { useState, useTransition } from 'react';
import { ActionIcon, Button, Card, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconX } from '@tabler/icons-react';
import { createCompensation, createIncome } from '@/actions/transactions';
import { CardLabel } from '@/components/CardLabel';
import { todayLocalISO } from '@/components/assets/today';
import type { SelectGroup } from '@/components/tx-helpers';
import { fmtMoney, parseAmountExpr, round2 } from '@/lib/money';

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
  type Item = { key: number; categoryId: string | null; amount: string; note: string };
  const emptyItem = (key: number): Item => ({ key, categoryId: null, amount: '', note: '' });
  const [items, setItems] = useState<Item[]>([emptyItem(0)]);
  const [received, setReceived] = useState('');
  const [date, setDate] = useState<string>(todayLocalISO());
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const patchItem = (key: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const spentTotal = items.reduce((s, it) => s + (parseAmountExpr(it.amount) ?? 0), 0);
  const itemsReady = items.every((it) => it.categoryId && parseAmountExpr(it.amount));

  const submit = () =>
    startTransition(async () => {
      if (!compensationSourceId) {
        notifications.show({ color: 'red', message: 'Источник «Компенсации» не найден' });
        return;
      }
      const res = await createCompensation({
        date,
        receivedAmount: received,
        items: items.map((it) => ({
          categoryId: Number(it.categoryId),
          amount: it.amount,
          note: it.note || undefined,
        })),
        accountId: Number(accountId),
        counterAccountId: Number(accountId),
        incomeSourceId: compensationSourceId,
        note: note || undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Компенсация записана: траты стали теневыми' });
        setItems([emptyItem(Date.now())]);
        setReceived('');
        setNote('');
      }
    });

  const body = (
      <Stack gap="sm">
        {!bare && <CardLabel>Компенсация (теневая трата)</CardLabel>}
        {items.map((it, i) => (
          <Stack
            key={it.key}
            gap={6}
            p="xs"
            style={{ border: '1px solid var(--ink-line)', borderRadius: 'var(--mantine-radius-md)' }}
          >
            <Group gap="xs" wrap="nowrap" align="flex-end">
              <Select
                label={i === 0 ? 'Категория траты' : undefined}
                data={categories}
                value={it.categoryId}
                onChange={(v) => patchItem(it.key, { categoryId: v })}
                searchable
                style={{ flex: 1 }}
              />
              <TextInput
                label={i === 0 ? 'Потрачено' : undefined}
                placeholder="10 000"
                value={it.amount}
                onChange={(e) => patchItem(it.key, { amount: e.currentTarget.value })}
                className="money"
                inputMode="decimal"
                w={110}
              />
              {items.length > 1 && (
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  mb={4}
                  onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                  aria-label="Убрать позицию"
                >
                  <IconX size={15} stroke={1.6} />
                </ActionIcon>
              )}
            </Group>
            <TextInput
              placeholder="Заметка к позиции"
              value={it.note}
              onChange={(e) => patchItem(it.key, { note: e.currentTarget.value })}
              size="xs"
            />
          </Stack>
        ))}
        <Group justify="space-between">
          <Button
            variant="subtle"
            size="compact-sm"
            leftSection={<IconPlus size={14} stroke={1.8} />}
            onClick={() => setItems((prev) => [...prev, emptyItem(Date.now())])}
          >
            Ещё позиция
          </Button>
          {items.length > 1 && spentTotal > 0 && (
            <Text fz="sm" c="dimmed" className="money">
              Потрачено всего: {fmtMoney(round2(spentTotal))}
            </Text>
          )}
        </Group>
        <TextInput
          label="Получено"
          placeholder="12 000"
          value={received}
          onChange={(e) => setReceived(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
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
        <TextInput
          label="Общая заметка"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group>
          <Button
            variant="light"
            onClick={submit}
            loading={pending}
            disabled={!itemsReady || !received}
          >
            Записать компенсацию
          </Button>
        </Group>
      </Stack>
  );
  return bare ? body : <Card>{body}</Card>;
}
