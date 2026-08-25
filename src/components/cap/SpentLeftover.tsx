'use client';

import { useState } from 'react';
import { Button, Group, Text } from '@mantine/core';
import { SpendDrawer } from './CapGoalRow';
import type { CapGoalOverview } from '@/queries/cap';
import { fmtMoneyExact } from '@/lib/money';

/** Остаток на завершённой цели (например, вернувшийся излишек):
    показывается рядом с ней и переносится в другие цели или на счёт. */
export function SpentLeftover({
  goal,
  otherGoals,
  returnAccounts,
}: {
  goal: CapGoalOverview;
  otherGoals: { id: number; name: string; remaining: number }[];
  returnAccounts: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Group gap="xs" wrap="nowrap">
      <Text fz="sm" c="orange.8" className="money">
        остаток {fmtMoneyExact(goal.contributed)}
      </Text>
      <Button size="compact-xs" variant="light" onClick={() => setOpen(true)}>
        Перенести…
      </Button>
      <SpendDrawer
        goal={goal}
        opened={open}
        onClose={() => setOpen(false)}
        otherGoals={otherGoals}
        returnAccounts={returnAccounts}
      />
    </Group>
  );
}
