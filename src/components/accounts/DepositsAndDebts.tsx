'use client';

import { useState, useTransition } from 'react';
import {
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { closeInterestDeposit, closeObligation, createObligation, openInterestDeposit } from '@/actions/misc';
import { Money } from '@/components/Money';
import { dateShort } from '@/lib/dates';
import { todayLocalISO } from '@/components/assets/today';

export function InterestDeposits({
  deposits,
  accounts,
  defaultAccountId,
}: {
  deposits: { id: number; name: string; balance: number }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
}) {
  const [openModal, setOpenModal] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [fromId, setFromId] = useState<string | null>(defaultAccountId ? String(defaultAccountId) : null);
  const [pending, startTransition] = useTransition();

  const open = () =>
    startTransition(async () => {
      const res = await openInterestDeposit({
        date: todayLocalISO(),
        amount,
        name,
        fromAccountId: Number(fromId),
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: `Вклад «${name}» открыт` });
        setOpenModal(false);
        setName('');
        setAmount('');
      }
    });

  return (
    <Stack gap="xs">
      {deposits.length === 0 && (
        <Text fz="sm" c="dimmed">
          Открытых процентных вкладов нет
        </Text>
      )}
      {deposits.map((d) => (
        <DepositRow key={d.id} d={d} />
      ))}
      <Group>
        <Button size="compact-sm" variant="light" onClick={() => setOpenModal(true)}>
          Открыть вклад
        </Button>
      </Group>
      <Modal opened={openModal} onClose={() => setOpenModal(false)} title="Процентный вклад" centered>
        <Stack gap="sm">
          <TextInput label="Название" placeholder="Вклад Т-Банк · сентябрь" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput
            label="Сумма"
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
            className="money"
            inputMode="decimal"
          />
          <Select
            label="Со счёта (тело вернётся сюда)"
            data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            value={fromId}
            onChange={setFromId}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpenModal(false)}>
              Отмена
            </Button>
            <Button onClick={open} loading={pending} disabled={!name || !amount || !fromId}>
              Открыть
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

function DepositRow({ d }: { d: { id: number; name: string; balance: number } }) {
  const [closing, setClosing] = useState(false);
  const [interest, setInterest] = useState('');
  const [pending, startTransition] = useTransition();

  const close = () =>
    startTransition(async () => {
      const res = await closeInterestDeposit({
        depositAccountId: d.id,
        date: todayLocalISO(),
        interest: interest || undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: `Вклад «${d.name}» закрыт, тело вернулось на исходный счёт` });
        setClosing(false);
      }
    });

  return (
    <Group justify="space-between" wrap="nowrap" py={4} style={{ borderBottom: '1px solid var(--ink-line)' }}>
      <Text fz="sm">{d.name}</Text>
      <Group gap="xs" wrap="nowrap">
        <Money value={d.balance} fz="sm" />
        {closing ? (
          <>
            <TextInput
              size="xs"
              w={110}
              placeholder="проценты"
              value={interest}
              onChange={(e) => setInterest(e.currentTarget.value)}
              className="money"
            />
            <Button size="compact-xs" onClick={close} loading={pending}>
              Закрыть
            </Button>
          </>
        ) : (
          <Button size="compact-xs" variant="subtle" onClick={() => setClosing(true)}>
            Закрыть…
          </Button>
        )}
      </Group>
    </Group>
  );
}

export function Obligations({
  items,
}: {
  items: {
    id: number;
    title: string;
    amount: number;
    status: string;
    openedAt: string;
    note: string | null;
  }[];
}) {
  const [modal, setModal] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      const res = await createObligation({
        title,
        amount,
        openedAt: todayLocalISO(),
        note: note || undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Обязательство записано' });
        setModal(false);
        setTitle('');
        setAmount('');
        setNote('');
      }
    });

  const close = (id: number) =>
    startTransition(async () => {
      const res = await closeObligation(id, todayLocalISO());
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
    });

  const open = items.filter((o) => o.status !== 'closed');
  const closed = items.filter((o) => o.status === 'closed');

  return (
    <Stack gap="xs">
      {open.length === 0 && (
        <Text fz="sm" c="dimmed">
          Открытых долгов и обязательств нет
        </Text>
      )}
      {open.map((o) => (
        <Group key={o.id} justify="space-between" wrap="nowrap" py={4} style={{ borderBottom: '1px solid var(--ink-line)' }}>
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fz="sm" truncate>
              {o.title}
            </Text>
            <Text fz="xs" c="dimmed">
              с {dateShort(o.openedAt)}
              {o.note ? ` · ${o.note}` : ''}
            </Text>
          </Stack>
          <Group gap="xs" wrap="nowrap">
            <Money value={o.amount} fz="sm" />
            <Button size="compact-xs" variant="subtle" onClick={() => close(o.id)} loading={pending}>
              Закрыть
            </Button>
          </Group>
        </Group>
      ))}
      {closed.length > 0 && (
        <Text fz="xs" c="dimmed">
          Закрыто: {closed.length}
        </Text>
      )}
      <Group>
        <Button size="compact-sm" variant="light" onClick={() => setModal(true)}>
          Добавить обязательство
        </Button>
      </Group>
      <Modal opened={modal} onClose={() => setModal(false)} title="Обязательство" centered>
        <Stack gap="sm">
          <TextInput
            label="Что за долг"
            placeholder="Должна себе 200 000 из КС"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
          />
          <TextInput
            label="Сумма"
            value={amount}
            onChange={(e) => setAmount(e.currentTarget.value)}
            className="money"
            inputMode="decimal"
          />
          <TextInput label="Заметка" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModal(false)}>
              Отмена
            </Button>
            <Button onClick={add} loading={pending} disabled={!title || !amount}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
