'use client';

import { useState, useTransition } from 'react';
import {
  Button,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { saveSnapshot } from '@/actions/misc';
import { BalanceBreakdownButton } from '@/components/balance/BalanceBreakdown';
import type { AccountBalance } from '@/queries/core';
import { Money } from '@/components/Money';
import { fmtMoney, parseAmountExpr, round2 } from '@/lib/money';
import { dateShort } from '@/lib/dates';
import { todayLocalISO } from '@/components/assets/today';

export function AccountsBoard({ balances }: { balances: AccountBalance[] }) {
  return (
    <Table verticalSpacing={8} fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Счёт</Table.Th>
          <Table.Th ta="right">Вычислено</Table.Th>
          <Table.Th ta="right" w={230}>
            Факт сегодня (сверка)
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {balances.map((b) => (
          <AccountRow key={b.accountId} b={b} />
        ))}
      </Table.Tbody>
    </Table>
  );
}

function AccountRow({ b }: { b: AccountBalance }) {
  const [value, setValue] = useState('');
  const [pending, startTransition] = useTransition();

  const parsed = value ? parseAmountExpr(value.replace(/^-/, '')) : null;
  const fact = parsed === null ? null : value.trim().startsWith('-') ? -parsed : parsed;
  const diff = fact === null ? null : round2(fact - b.balance);

  const save = () =>
    startTransition(async () => {
      const res = await saveSnapshot({
        accountId: b.accountId,
        onDate: todayLocalISO(),
        balance: value,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: `Снапшот «${b.name}» сохранён` });
        setValue('');
      }
    });

  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm" fw={500}>
          {b.name}
        </Text>
        <Text fz="xs" c="dimmed">
          {b.lastSnapshotDate ? `сверка ${dateShort(b.lastSnapshotDate)}` : 'сверок не было'}
        </Text>
      </Table.Td>
      <Table.Td ta="right">
        <Group gap={2} wrap="nowrap" justify="flex-end">
          <Money value={b.balance} currency={b.currency} fz="sm" />
          <BalanceBreakdownButton accountId={b.accountId} name={b.name} currency={b.currency} />
        </Group>
      </Table.Td>
      <Table.Td>
        <Stack gap={2}>
          <Group gap={6} wrap="nowrap" justify="flex-end">
            <TextInput
              size="xs"
              w={120}
              placeholder={fmtMoney(b.balance, b.currency)}
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              className="money"
              inputMode="decimal"
              styles={{ input: { textAlign: 'right' } }}
            />
            <Tooltip label="Сохранить сверочный снапшот на сегодня">
              <Button size="compact-xs" variant="light" onClick={save} loading={pending} disabled={fact === null}>
                ОК
              </Button>
            </Tooltip>
          </Group>
          {diff !== null && Math.abs(diff) > 0.005 && (
            <Text fz="xs" ta="right" c={Math.abs(diff) > 0.005 ? 'orange.8' : 'dimmed'} className="money">
              расхождение {diff > 0 ? '+' : ''}
              {fmtMoney(diff)}
            </Text>
          )}
          {diff !== null && Math.abs(diff) <= 0.005 && (
            <Text fz="xs" ta="right" c="ink.7">
              сходится ✓
            </Text>
          )}
        </Stack>
      </Table.Td>
    </Table.Tr>
  );
}
