'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ActionIcon, Divider, Drawer, Stack, Text, Tooltip } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { QuickExpense } from './QuickExpense';
import { TxList } from './TxList';
import { FilledDayToggle } from './day/FilledDayToggle';
import type { TxRow } from '@/queries/core';
import type { SelectGroup } from './tx-helpers';

export function NewDayDrawer({
  date,
  dateTitle,
  categories,
  defaultAccountId,
  txs,
  filled = false,
}: {
  date: string;
  dateTitle: string;
  categories: SelectGroup[];
  defaultAccountId: number | null;
  txs: TxRow[];
  filled?: boolean;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Tooltip label="Новый день" position="left">
        <ActionIcon
          onClick={() => setOpened(true)}
          size={46}
          radius="50%"
          variant="filled"
          aria-label="Новый день"
        >
          <IconPlus size={24} stroke={2} />
        </ActionIcon>
      </Tooltip>
      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size="md"
        title={
          <Text fw={600} fz="md">
            Новый день · {dateTitle}
          </Text>
        }
        padding="lg"
      >
        <Stack gap="md">
          <QuickExpense
            date={date}
            categories={categories}
            defaultAccountId={defaultAccountId}
            compact
          />
          <Divider label="Операции сегодня" labelPosition="left" />
          <TxList items={txs} emptyText="Пока пусто — самое время для первой записи" />
          <FilledDayToggle date={date} initial={filled} />
          <Link href={`/day/${date}`} className="dash-link" onClick={() => setOpened(false)}>
            <Text fz="sm" c="ink.7" fw={500}>
              Вся страница дня: покупки, переводы, наличные, КС →
            </Text>
          </Link>
        </Stack>
      </Drawer>
    </>
  );
}
