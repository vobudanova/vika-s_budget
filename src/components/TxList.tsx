'use client';

import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPencil, IconX } from '@tabler/icons-react';
import { deleteTransaction, updateTransaction } from '@/actions/transactions';
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
      {items.map((t) => (
        <TxLine key={t.id} t={t} showDate={showDate} onEdit={() => setEditing(t)} />
      ))}
      <EditModal t={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}

function TxLine({ t, showDate, onEdit }: { t: TxRow; showDate: boolean; onEdit: () => void }) {
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
      style={{ borderBottom: '1px solid var(--ink-line)', opacity: pending ? 0.4 : 1 }}
    >
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text fz="sm" fw={500} truncate>
          {showDate ? `${t.date.slice(8, 10)}.${t.date.slice(5, 7)} · ` : ''}
          {title}
        </Text>
        {detail && (
          <Text fz="xs" c="dimmed" truncate>
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

function EditModal({ t, onClose }: { t: TxRow | null; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [opened, setOpened] = useState(false);

  // Синхронизация при открытии
  if (t && !opened) {
    setAmount(fmtMoney(Math.abs(t.amount)).replace(/[  ₽]/g, ''));
    setNote(t.note ?? '');
    setDate(t.date);
    setOpened(true);
  }
  if (!t && opened) setOpened(false);

  const save = () =>
    startTransition(async () => {
      if (!t) return;
      const res = await updateTransaction({ id: t.id, amount, note, date });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        onClose();
      }
    });

  return (
    <Modal opened={!!t} onClose={onClose} title="Изменить операцию" centered size="sm">
      <Stack gap="sm">
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
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
