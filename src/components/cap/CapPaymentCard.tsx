'use client';

import { useState, useTransition } from 'react';
import { Button, Card, Group, Select, Stack, Table, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { sendCapPayment } from '@/actions/cap';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';

export function CapPaymentCard({
  ym,
  monthTitle,
  pending,
  total,
  accounts,
  defaultAccountId,
}: {
  ym: string;
  monthTitle: string;
  pending: { goalId: number; name: string; amount: number }[];
  total: number;
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
}) {
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [busy, startTransition] = useTransition();

  const send = () =>
    startTransition(async () => {
      const res = await sendCapPayment({ ym, fromAccountId: Number(accountId) });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Платёж КАП отправлен единым переводом' });
      }
    });

  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Платёж {monthTitle} · по флажкам</CardLabel>
        {pending.length === 0 ? (
          <Text fz="sm" c="dimmed">
            Все отмеченные взносы месяца уже отправлены. Проставьте флажки на целях — и они появятся
            здесь.
          </Text>
        ) : (
          <>
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
                      Итого единым переводом
                    </Text>
                  </Table.Td>
                  <Table.Td px={0} ta="right">
                    <Money value={total} fw={700} fz="sm" />
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
            <Group gap="xs" align="flex-end">
              <Select
                label="Счёт списания"
                data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
                value={accountId}
                onChange={setAccountId}
                w={220}
              />
              <Button onClick={send} loading={busy} disabled={!accountId}>
                Отправить на счёт КАП
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Card>
  );
}
