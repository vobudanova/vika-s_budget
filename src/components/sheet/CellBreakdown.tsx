'use client';

import { useEffect, useState } from 'react';
import { Group, Loader, Stack, Text } from '@mantine/core';
import { FormDrawer } from '@/components/FormDrawer';
import { getCellBreakdown, type CellBreakdown } from '@/actions/breakdown';
import { Money } from '@/components/Money';

export type CellQuery = { from: string; to: string; section: string; row: string | null };

/** Шторка «из чего сложилось число»: список записей ячейки листа. */
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

  useEffect(() => {
    if (!query) return;
    setData(null);
    setError(null);
    getCellBreakdown(query).then((res) => {
      if ('error' in res) setError(res.error);
      else setData(res);
    });
  }, [query]);

  const showDates = !!query && query.from !== query.to;

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
      {data && (
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
              style={{ borderTop: '1px solid var(--ink-line)' }}
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
              <Money value={it.amount} fz="sm" style={{ flexShrink: 0 }} />
            </Group>
          ))}
        </Stack>
      )}
    </FormDrawer>
  );
}
