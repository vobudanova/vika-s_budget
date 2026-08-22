'use client';

import { useEffect, useState } from 'react';
import { ActionIcon, Group, Loader, Stack, Text, Tooltip } from '@mantine/core';
import { IconListSearch } from '@tabler/icons-react';
import { FormDrawer } from '@/components/FormDrawer';
import { getAccountBreakdown, type AccountBreakdown } from '@/actions/breakdown';
import { Money } from '@/components/Money';
import { dateShort } from '@/lib/dates';

/** «Как вычислилось»: снапшот + операции после него, до текущего баланса. */
export function BalanceBreakdownButton({
  accountId,
  name,
  currency = 'RUB',
}: {
  accountId: number;
  name: string;
  currency?: 'RUB' | 'USD';
}) {
  const [opened, setOpened] = useState(false);
  const [data, setData] = useState<AccountBreakdown | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!opened) return;
    setData(null);
    setError(null);
    getAccountBreakdown(accountId).then((res) => {
      if ('error' in res) setError(res.error);
      else setData(res);
    });
  }, [opened, accountId]);

  return (
    <>
      <Tooltip label="Как вычислилось">
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => setOpened(true)}
          aria-label={`Как вычислилось: ${name}`}
        >
          <IconListSearch size={14} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title={name}>
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
            <Group justify="space-between" py={7} style={{ borderBottom: '1px solid var(--ink-line)' }}>
              <Text fz="sm" fw={600}>
                {data.snapshot
                  ? `Зафиксировано ${dateShort(data.snapshot.date)}`
                  : 'Фиксаций не было — считается с нуля'}
              </Text>
              {data.snapshot && <Money value={data.snapshot.balance} currency={currency} fz="sm" fw={600} />}
            </Group>
            {data.items.length === 0 && (
              <Text c="dimmed" fz="sm" py="md">
                Операций после фиксации нет
              </Text>
            )}
            {data.items.map((it, i) => (
              <Group
                key={i}
                justify="space-between"
                wrap="nowrap"
                py={7}
                gap="md"
                style={{ borderBottom: '1px solid var(--ink-line)' }}
              >
                <Stack gap={0} style={{ minWidth: 0 }}>
                  <Text fz="sm" fw={500} truncate>
                    {`${it.date.slice(8, 10)}.${it.date.slice(5, 7)} · `}
                    {it.label}
                  </Text>
                  {it.sub && (
                    <Text fz="xs" c="dimmed" truncate>
                      {it.sub}
                    </Text>
                  )}
                </Stack>
                <Money
                  value={it.amount}
                  currency={currency}
                  signed={it.amount > 0}
                  fz="sm"
                  c={it.amount > 0 ? 'ink.7' : undefined}
                  style={{ flexShrink: 0 }}
                />
              </Group>
            ))}
            <Group justify="space-between" py={9}>
              <Text fz="sm" fw={700}>
                Вычислено
              </Text>
              <Money value={data.total} currency={currency} fw={700} />
            </Group>
          </Stack>
        )}
      </FormDrawer>
    </>
  );
}
