'use client';

import { useTransition } from 'react';
import { Button, Group } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { confirmDanger } from '@/lib/confirm';
import { wipePageData, type WipeScope } from '@/actions/danger';

/** «Удалить все данные» раздела: двойное подтверждение, необратимо. */
export function WipeButton({ scope, label }: { scope: WipeScope; label: string }) {
  const [pending, startTransition] = useTransition();

  const run = () =>
    confirmDanger({
      title: 'Удалить все данные',
      message: `Будут удалены: ${label}. Действие необратимо.`,
      confirmLabel: 'Удалить',
      onConfirm: () =>
        confirmDanger({
          title: 'Точно удалить?',
          message: 'Восстановить данные будет нельзя.',
          confirmLabel: 'Да, удалить навсегда',
          onConfirm: () =>
            startTransition(async () => {
              const res = await wipePageData(scope);
              notifications.show(
                res.ok ? { message: 'Данные удалены' } : { color: 'red', message: res.error },
              );
            }),
        }),
    });

  return (
    <Group justify="flex-end" mt="md">
      <Button
        variant="subtle"
        color="red"
        size="compact-xs"
        leftSection={<IconTrash size={13} />}
        onClick={run}
        loading={pending}
      >
        Удалить все данные
      </Button>
    </Group>
  );
}
