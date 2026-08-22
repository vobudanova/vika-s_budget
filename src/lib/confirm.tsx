'use client';

import { Text } from '@mantine/core';
import { modals } from '@mantine/modals';

/** Подтверждение опасного действия — модалка Mantine вместо браузерного confirm. */
export function confirmDanger({
  title,
  message,
  confirmLabel = 'Удалить',
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  modals.openConfirmModal({
    title,
    centered: true,
    children: <Text fz="sm">{message}</Text>,
    labels: { confirm: confirmLabel, cancel: 'Отмена' },
    confirmProps: { color: 'red' },
    onConfirm,
  });
}
