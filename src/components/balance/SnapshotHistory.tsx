'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Loader,
  NumberInput,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconHistory, IconPencil, IconX } from '@tabler/icons-react';
import { FormDrawer } from '@/components/FormDrawer';
import { deleteSnapshot, listSnapshots, updateSnapshot, type SnapshotRow } from '@/actions/misc';
import { confirmDanger } from '@/lib/confirm';
import { Money } from '@/components/Money';
import { dateShort } from '@/lib/dates';

/** История сверок счёта: список снапшотов с правкой и удалением. */
export function SnapshotHistoryButton({
  accountId,
  name,
  lastDate,
}: {
  accountId: number;
  name: string;
  lastDate: string | null;
}) {
  const [opened, setOpened] = useState(false);
  const [rows, setRows] = useState<SnapshotRow[] | null>(null);
  const [editing, setEditing] = useState<SnapshotRow | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = () => listSnapshots(accountId).then(setRows);

  useEffect(() => {
    if (!opened) return;
    setRows(null);
    setEditing(null);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, accountId]);

  const remove = (s: SnapshotRow) =>
    confirmDanger({
      title: 'Удалить сверку',
      message: `Сверка от ${dateShort(s.onDate)} будет удалена — баланс пересчитается от предыдущей.`,
      onConfirm: () =>
        startTransition(async () => {
          const res = await deleteSnapshot(s.id);
          if (!res.ok) notifications.show({ color: 'red', message: res.error });
          reload();
        }),
    });

  return (
    <>
      <UnstyledButton onClick={() => setOpened(true)}>
        <Group gap={4} wrap="nowrap">
          <IconHistory size={12} stroke={1.6} color="var(--mantine-color-gray-6)" />
          <Text fz="xs" c="dimmed" td="underline dotted">
            {lastDate ? `сверка ${dateShort(lastDate)}` : 'сверок не было'}
          </Text>
        </Group>
      </UnstyledButton>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title={`Сверки: ${name}`}>
        {!rows && (
          <Group justify="center" py="xl">
            <Loader size="sm" color="ink" />
          </Group>
        )}
        {rows && rows.length === 0 && (
          <Text c="dimmed" fz="sm">
            Сверок ещё не было.
          </Text>
        )}
        {rows && (
          <Stack gap={0}>
            {rows.map((s) =>
              editing?.id === s.id ? (
                <EditRow
                  key={s.id}
                  snap={s}
                  onDone={() => {
                    setEditing(null);
                    reload();
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <Group
                  key={s.id}
                  justify="space-between"
                  wrap="nowrap"
                  py={7}
                  gap="xs"
                  style={{ borderBottom: '1px solid var(--ink-line)', opacity: pending ? 0.5 : 1 }}
                >
                  <Text fz="sm" className="money">
                    {dateShort(s.onDate)}
                  </Text>
                  <Group gap={4} wrap="nowrap">
                    <Money value={s.balance} fz="sm" fw={500} />
                    <Tooltip label="Изменить">
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setEditing(s)}>
                        <IconPencil size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Удалить">
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => remove(s)}>
                        <IconX size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              ),
            )}
          </Stack>
        )}
      </FormDrawer>
    </>
  );
}

function EditRow({
  snap,
  onDone,
  onCancel,
}: {
  snap: SnapshotRow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState<string | null>(snap.onDate);
  const [value, setValue] = useState<number | string>(snap.balance);
  const [pending, startTransition] = useTransition();

  const save = () =>
    startTransition(async () => {
      const res = await updateSnapshot({
        id: snap.id,
        onDate: date ?? snap.onDate,
        balance: Number(value) || 0,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        onDone();
      }
    });

  return (
    <Stack gap="xs" py={8} style={{ borderBottom: '1px solid var(--ink-line)' }}>
      <Group gap="xs" wrap="nowrap" align="flex-end">
        <DatePickerInput
          label="Дата"
          value={date}
          onChange={(v) => setDate(v ? String(v).slice(0, 10) : null)}
          valueFormat="D MMM YYYY"
          size="xs"
          w={140}
          popoverProps={{ shadow: 'md' }}
        />
        <NumberInput
          label="Сумма"
          value={value}
          onChange={setValue}
          hideControls
          decimalScale={2}
          thousandSeparator=" "
          size="xs"
          className="money"
          style={{ flex: 1 }}
        />
      </Group>
      <Group justify="flex-end" gap="xs">
        <Button size="compact-xs" variant="default" onClick={onCancel}>
          Отмена
        </Button>
        <Button size="compact-xs" onClick={save} loading={pending}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}
