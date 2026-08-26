'use client';

import { useState } from 'react';
import { Button, Center, Group, Stack, Text } from '@mantine/core';
import type { CapGoalOverview } from '@/queries/cap';
import { SpentLeftover } from './SpentLeftover';
import { fmtMoneyExact } from '@/lib/money';
import { ymOf, ymTitle } from '@/lib/dates';

/** Завершённые цели: первые 10, остальные разворачиваются. */
export function SpentList({
  goals,
  today,
  openGoalsForTransfer,
  returnAccounts,
}: {
  goals: CapGoalOverview[];
  today: string;
  openGoalsForTransfer: { id: number; name: string; remaining: number }[];
  returnAccounts: { id: number; name: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? goals : goals.slice(0, 10);

  return (
    <Stack gap="xs">
      {visible.map((g) => (
        <Group key={g.id} justify="space-between" wrap="wrap" gap="xs">
          <Text fz="sm" c="dimmed">
            {g.name}
          </Text>
          <Group gap="md" wrap="nowrap">
            {g.contributed > 0.005 && (
              <SpentLeftover
                goal={g}
                otherGoals={openGoalsForTransfer.filter((o) => o.id !== g.id)}
                returnAccounts={returnAccounts}
              />
            )}
            <Text fz="sm" c="dimmed" className="money">
              {fmtMoneyExact(g.target)} · {ymTitle(ymOf(g.spentAt ?? today))}
            </Text>
          </Group>
        </Group>
      ))}
      {goals.length > 10 && !expanded && (
        <Center>
          <Button variant="subtle" size="compact-sm" onClick={() => setExpanded(true)}>
            Показать все · ещё {goals.length - 10}
          </Button>
        </Center>
      )}
    </Stack>
  );
}
