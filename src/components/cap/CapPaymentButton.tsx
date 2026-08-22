'use client';

import { useState, useTransition } from 'react';
import { Button, Group, Select, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { sendCapPayment } from '@/actions/cap';
import { Money } from '@/components/Money';
import { FormDrawer } from '@/components/FormDrawer';
import { fmtMoney } from '@/lib/money';

/** Единый платёж месяца по проставленным флажкам — компактная кнопка в шапке. */
export function CapPaymentButton({
  ym,
  pending,
  total,
  accounts,
  defaultAccountId,
}: {
  ym: string;
  pending: { goalId: number; name: string; amount: number }[];
  total: number;
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
}) {
  const [opened, setOpened] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [busy, startTransition] = useTransition();

  if (pending.length === 0) return null;

  const send = () =>
    startTransition(async () => {
      const res = await sendCapPayment({ ym, fromAccountId: Number(accountId) });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Платёж КАП отправлен единым переводом' });
        setOpened(false);
      }
    });

  return (
    <>
      <Button variant="light" onClick={() => setOpened(true)}>
        Отправить платёж · {fmtMoney(total)}
      </Button>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title="Платёж месяца по флажкам">
        <Stack gap="sm">
          <Table verticalSpacing={4} fz="sm">
            <Table.Tbody>
              {pending.map((p) => (
                <Table.Tr key={p.goalId}>
                  <Table.Td px={0}>{p.name}</Table.Td>
                  <Table.Td px={0} ta="right">
                    <Money value={p.amount} fz="sm" />
                  </Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr>
                <Table.Td px={0}>
                  <Text fw={700} fz="sm">
                    Итого
                  </Text>
                </Table.Td>
                <Table.Td px={0} ta="right">
                  <Money value={total} fw={700} fz="sm" />
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Select
            label="Счёт списания"
            data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
            value={accountId}
            onChange={setAccountId}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>
              Отмена
            </Button>
            <Button onClick={send} loading={busy} disabled={!accountId}>
              Отправить на счёт КАП
            </Button>
          </Group>
        </Stack>
      </FormDrawer>
    </>
  );
}
