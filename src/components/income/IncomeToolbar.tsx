'use client';

import { useState } from 'react';
import { Button, Group } from '@mantine/core';
import { FormDrawer } from '@/components/FormDrawer';
import { CompensationForm, IncomeForm } from '@/components/income/IncomeForms';
import type { SelectGroup } from '@/components/tx-helpers';

/** Кнопки «Новый доход» и «Компенсация» в шапке страницы — формы в шторках. */
export function IncomeToolbar({
  sources,
  accounts,
  defaultAccountId,
  categories,
  compensationSourceId,
}: {
  sources: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
  categories: SelectGroup[];
  compensationSourceId: number | null;
}) {
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);

  return (
    <Group gap="xs">
      <Button onClick={() => setIncomeOpen(true)}>Новый доход</Button>
      <Button variant="light" onClick={() => setCompOpen(true)}>
        Компенсация…
      </Button>
      <FormDrawer opened={incomeOpen} onClose={() => setIncomeOpen(false)} title="Новый доход">
        <IncomeForm sources={sources} accounts={accounts} defaultAccountId={defaultAccountId} bare />
      </FormDrawer>
      <FormDrawer
        opened={compOpen}
        onClose={() => setCompOpen(false)}
        title="Компенсация (теневая трата)"
      >
        <CompensationForm
          categories={categories}
          accounts={accounts}
          compensationSourceId={compensationSourceId}
          defaultAccountId={defaultAccountId}
          bare
        />
      </FormDrawer>
    </Group>
  );
}
