'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import { IconPencil, IconX } from '@tabler/icons-react';
import { deleteTransaction, updateTransaction } from '@/actions/transactions';
import { listEditRefs } from '@/actions/reference';
import { confirmDanger } from '@/lib/confirm';
import type { TxRow } from '@/queries/core';
import { txLabel, txSign } from './tx-helpers';
import { Money } from './Money';
import { fmtMoney } from '@/lib/money';

export function TxList({
  items,
  emptyText = 'Операций пока нет',
  showDate = false,
}: {
  items: TxRow[];
  emptyText?: string;
  showDate?: boolean;
}) {
  const [editing, setEditing] = useState<TxRow | null>(null);

  if (items.length === 0) {
    return (
      <Text c="dimmed" fz="sm" py="xs">
        {emptyText}
      </Text>
    );
  }

  return (
    <Stack gap={0}>
      {items.map((t, i) => (
        <TxLine key={t.id} t={t} showDate={showDate} last={i === items.length - 1} onEdit={() => setEditing(t)} />
      ))}
      <EditModal t={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}

function TxLine({ t, showDate, last, onEdit }: { t: TxRow; showDate: boolean; last?: boolean; onEdit: () => void }) {
  const [pending, startTransition] = useTransition();
  const { title, detail } = txLabel(t);
  const sign = txSign(t);
  // Расходы показываем как введены (возврат — отрицательный, зелёный),
  // приходы — со знаком «+», внутренние переводы — как есть.
  const isRefund = sign < 0 && t.amount < 0;
  const displayValue = sign > 0 ? Math.abs(t.amount) : t.amount;

  const remove = () =>
    startTransition(async () => {
      const res = await deleteTransaction(t.id);
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
    });

  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      py={7}
      gap="xs"
      style={{ borderBottom: last ? 'none' : '1px solid var(--ink-line)', opacity: pending ? 0.4 : 1 }}
    >
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text fz="sm" fw={500} truncate>
          {showDate ? `${t.date.slice(8, 10)}.${t.date.slice(5, 7)} · ` : ''}
          {title}
        </Text>
        {detail && (
          <Text fz="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
            {detail}
          </Text>
        )}
      </Stack>
      <Group gap={4} wrap="nowrap">
        <Money
          value={displayValue}
          signed={sign > 0}
          fz="sm"
          fw={500}
          c={sign > 0 || isRefund ? 'ink.7' : undefined}
        />
        <Tooltip label="Изменить">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={onEdit} aria-label="Изменить">
            <IconPencil size={15} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Удалить">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={remove}
            loading={pending}
            aria-label="Удалить"
          >
            <IconX size={15} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}

type EditRefs = {
  categories: { id: number; name: string; groupName: string }[];
  accounts: { id: number; name: string }[];
};

function EditModal({ t, onClose }: { t: TxRow | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [refs, setRefs] = useState<EditRefs | null>(null);

  // Синхронизация при открытии; выражение показывается как введено («300+500-200»)
  useEffect(() => {
    if (!t) return;
    setAmount(t.amountExpr ?? fmtMoney(Math.abs(t.amount)).replace(/[  ₽]/g, ''));
    setNote(t.note ?? '');
    setDate(t.date);
    setCategoryId(t.categoryId ? String(t.categoryId) : null);
    setAccountId(t.accountId ? String(t.accountId) : null);
  }, [t]);

  // Справочники подгружаются один раз при первом открытии
  useEffect(() => {
    if (t && !refs) listEditRefs().then(setRefs);
  }, [t, refs]);

  const save = () =>
    startTransition(async () => {
      if (!t) return;
      const res = await updateTransaction({
        id: t.id,
        amount,
        note,
        date,
        ...(t.kind === 'expense' && categoryId ? { categoryId: Number(categoryId) } : {}),
        ...(accountId ? { accountId: Number(accountId) } : {}),
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        onClose();
      }
    });

  const remove = () => {
    if (!t) return;
    confirmDanger({
      title: 'Удалить операцию',
      message: `Операция на ${fmtMoney(Math.abs(t.amount))} будет удалена.`,
      onConfirm: () =>
        startTransition(async () => {
          const res = await deleteTransaction(t.id);
          if (!res.ok) {
            notifications.show({ color: 'red', message: res.error });
          } else {
            onClose();
          }
        }),
    });
  };

  const categoryData = (refs?.categories ?? []).reduce<
    { group: string; items: { value: string; label: string }[] }[]
  >((acc, c) => {
    const g = acc.find((x) => x.group === c.groupName);
    const item = { value: String(c.id), label: c.name };
    if (g) g.items.push(item);
    else acc.push({ group: c.groupName, items: [item] });
    return acc;
  }, []);

  return (
    <FormDrawer opened={!!t} onClose={onClose} title="Изменить операцию" desktopSize="sm">
      <Stack gap="sm">
        {t?.kind === 'expense' && (
          <Select
            label="Категория"
            data={categoryData}
            value={categoryId}
            onChange={setCategoryId}
            searchable
            placeholder={refs ? 'Выберите категорию' : 'Загрузка…'}
          />
        )}
        <Select
          label="Счёт"
          data={(refs?.accounts ?? []).map((a) => ({ value: String(a.id), label: a.name }))}
          value={accountId}
          onChange={setAccountId}
          placeholder={refs ? 'Выберите счёт' : 'Загрузка…'}
        />
        <TextInput
          label="Дата"
          value={date}
          onChange={(e) => setDate(e.currentTarget.value)}
          placeholder="2026-08-21"
        />
        <TextInput
          label="Сумма"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
        />
        <TextInput label="Заметка" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        <Group justify="space-between">
          <Button variant="subtle" color="red" onClick={remove}>
            Удалить
          </Button>
          <Group>
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={save} loading={pending}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </Stack>
    </FormDrawer>
  );
}
