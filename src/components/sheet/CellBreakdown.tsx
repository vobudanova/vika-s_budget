'use client';

import { useEffect, useState, useTransition } from 'react';
import { ActionIcon, Button, Group, Loader, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconPencil, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import { getCellBreakdown, type CellBreakdown, type CellItem } from '@/actions/breakdown';
import { deleteFundMovement, updateFundMovement } from '@/actions/fund';
import { confirmDanger } from '@/lib/confirm';
import { Money } from '@/components/Money';
import { fmtMoney } from '@/lib/money';

export type CellQuery = { from: string; to: string; section: string; row: string | null };

/** Шторка «из чего сложилось число»: список записей ячейки листа.
    Строки движений фонда (КС) — редактируемые и удаляемые. */
export function CellBreakdownDrawer({
  query,
  title,
  onClose,
}: {
  query: CellQuery | null;
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<CellBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CellItem | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (!query) return;
    if (reloadKey === 0) setData(null);
    setError(null);
    getCellBreakdown(query).then((res) => {
      if ('error' in res) setError(res.error);
      else setData(res);
    });
  }, [query, reloadKey]);

  useEffect(() => {
    setEditing(null);
    setReloadKey(0);
  }, [query]);

  const showDates = !!query && query.from !== query.to;

  const remove = (it: CellItem) =>
    confirmDanger({
      title: 'Удалить движение?',
      message: `${it.label} · ${fmtMoney(Math.abs(it.amount))}`,
      onConfirm: async () => {
        if (!it.moveId) return;
        setBusyId(it.moveId);
        const res = await deleteFundMovement(it.moveId);
        setBusyId(null);
        if (!res.ok) notifications.show({ color: 'red', message: res.error });
        else setReloadKey((k) => k + 1);
      },
    });

  return (
    <FormDrawer opened={!!query} onClose={onClose} title={title}>
      {!data && !error && (
        <Group justify="center" py="xl">
          <Loader size="sm" color="ink" />
        </Group>
      )}
      {error && (
        <Text c="red.8" fz="sm">
          {error}
        </Text>
      )}
      {data && editing && (
        <EditMoveForm
          item={editing}
          onDone={(changed) => {
            setEditing(null);
            if (changed) setReloadKey((k) => k + 1);
          }}
        />
      )}
      {data && !editing && (
        <Stack gap={0}>
          <Group justify="space-between" pb="sm">
            <Text fz="sm" c="dimmed">
              {data.items.length} зап.
            </Text>
            <Money value={data.total} fw={700} />
          </Group>
          {data.items.length === 0 && (
            <Text c="dimmed" fz="sm" py="md">
              Записей нет
            </Text>
          )}
          {data.items.map((it, i) => (
            <Group
              key={i}
              justify="space-between"
              wrap="nowrap"
              py={7}
              gap="md"
              style={{ borderTop: '1px solid var(--ink-line)', opacity: busyId === it.moveId ? 0.4 : 1 }}
            >
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text fz="sm" fw={500} truncate>
                  {showDates ? `${it.date.slice(8, 10)}.${it.date.slice(5, 7)} · ` : ''}
                  {it.label}
                </Text>
                {it.sub && (
                  <Text fz="xs" c="dimmed" truncate>
                    {it.sub}
                  </Text>
                )}
              </Stack>
              <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                <Money value={it.amount} fz="sm" />
                {it.moveId && (
                  <>
                    <Tooltip label="Изменить">
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setEditing(it)}>
                        <IconPencil size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Удалить">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        onClick={() => remove(it)}
                        disabled={busyId !== null}
                      >
                        <IconX size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                  </>
                )}
              </Group>
            </Group>
          ))}
        </Stack>
      )}
    </FormDrawer>
  );
}

/** Мини-форма правки движения фонда: дата, сумма (по модулю), заметка. */
function EditMoveForm({ item, onDone }: { item: CellItem; onDone: (changed: boolean) => void }) {
  const [date, setDate] = useState(item.date);
  const [amount, setAmount] = useState(String(Math.abs(item.amount)).replace('.', ','));
  const [note, setNote] = useState(item.sub ?? '');
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      if (!item.moveId) return;
      const res = await updateFundMovement({ id: item.moveId, date, amount, note });
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
      else onDone(true);
    });

  return (
    <Stack gap="sm">
      <Text fz="sm" fw={600}>
        {item.label}
      </Text>
      <TextInput label="Дата" value={date} onChange={(e) => setDate(e.currentTarget.value)} placeholder="2026-08-23" />
      <TextInput
        label="Сумма"
        value={amount}
        onChange={(e) => setAmount(e.currentTarget.value)}
        className="money"
        inputMode="decimal"
      />
      <TextInput label="Заметка" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => onDone(false)}>
          Отмена
        </Button>
        <Button onClick={save} loading={pending}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
