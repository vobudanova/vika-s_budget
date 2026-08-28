'use client';

import { useState } from 'react';
import { ActionIcon, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconZoom } from '@tabler/icons-react';
import { FormDrawer } from '@/components/FormDrawer';
import { Money } from '@/components/Money';
import type { CapAllocationMove } from '@/queries/cap';
import { fmtMoneyExact } from '@/lib/money';

/** «Размещения фонда»: сумма считается из операций, помеченных «размещение
    фонда КАП» (переводы/сбережения со счёта КАП); лупа показывает их список. */
export function AllocationsCell({ value, moves }: { value: number; moves: CapAllocationMove[] }) {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <Group gap={4} wrap="nowrap" justify="flex-end">
        <Money value={value} fz="sm" exact />
        <Tooltip label="Из чего складывается">
          <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setOpened(true)}>
            <IconZoom size={13} stroke={1.6} />
          </ActionIcon>
        </Tooltip>
      </Group>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title="Размещения фонда КАП">
        <Stack gap="sm">
          {moves.length === 0 ? (
            <Text fz="sm" c="dimmed">
              Помеченных операций пока нет.
            </Text>
          ) : (
            <Stack gap={6}>
              {moves.map((m) => (
                <Group key={m.id} justify="space-between" wrap="nowrap" gap="xs">
                  <Stack gap={0} style={{ minWidth: 0 }}>
                    <Text fz="sm" truncate>
                      {`${m.date.slice(8, 10)}.${m.date.slice(5, 7)}.${m.date.slice(0, 4)}`} ·{' '}
                      {m.fromName ?? '?'} → {m.toName ?? '?'}
                    </Text>
                    {m.note && (
                      <Text fz="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                        {m.note}
                      </Text>
                    )}
                  </Stack>
                  <Text
                    fz="sm"
                    fw={500}
                    className="money"
                    c={m.direction < 0 ? 'teal.8' : undefined}
                    style={{ flexShrink: 0 }}
                  >
                    {m.direction < 0 ? '−' : '+'}
                    {fmtMoneyExact(m.amount)}
                  </Text>
                </Group>
              ))}
              <Group justify="space-between" pt={4} style={{ borderTop: '1px solid var(--ink-line)' }}>
                <Text fz="sm" fw={700}>
                  Итого размещено
                </Text>
                <Text fz="sm" fw={700} className="money">
                  {fmtMoneyExact(value)}
                </Text>
              </Group>
            </Stack>
          )}
          <Text fz="xs" c="dimmed">
            Сюда попадают переводы и сбережения со счёта КАП с галкой «Размещение фонда КАП» —
            поставить её можно в форме перевода или при изменении операции. Возврат на счёт КАП
            (галка на обратном переводе) уменьшает сумму.
          </Text>
        </Stack>
      </FormDrawer>
    </>
  );
}
