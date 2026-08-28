'use client';

import { useState, useTransition } from 'react';
import { ActionIcon, Button, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconPencil } from '@tabler/icons-react';
import { FormDrawer } from '@/components/FormDrawer';
import { saveSnapshot } from '@/actions/misc';
import { todayLocalISO } from '@/components/assets/today';
import { fmtMoney, fmtMoneyExact, parseAmountExpr } from '@/lib/money';

/** Ввод фактической суммы на счёте: снапшот на сегодня. Операции задним
    числом баланс больше не двигают — влияют только будущие. */
export function FactButton({
  accountId,
  name,
  current,
}: {
  accountId: number;
  name: string;
  current: number;
}) {
  const [opened, setOpened] = useState(false);
  const [value, setValue] = useState('');
  const [date, setDate] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const open = () => {
    setValue(String(Math.round(current * 100) / 100).replace('.', ','));
    setDate(todayLocalISO());
    setOpened(true);
  };

  // раньше здесь был NumberInput с точкой-разделителем: запятая копеек молча
  // выбрасывалась и «138579,22» превращалось в 13 857 922
  const negative = value.trim().startsWith('-');
  const parsedAbs = parseAmountExpr(value.replace(/^-/, ''));
  const parsed = parsedAbs == null ? null : negative ? -parsedAbs : parsedAbs;

  const save = () =>
    startTransition(async () => {
      const res = await saveSnapshot({
        accountId,
        onDate: date ?? todayLocalISO(),
        balance: value,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: `«${name}»: факт зафиксирован` });
        setOpened(false);
      }
    });

  return (
    <>
      <Tooltip label="Указать фактическую сумму">
        <ActionIcon variant="subtle" color="gray" size="sm" onClick={open} aria-label={`Факт: ${name}`}>
          <IconPencil size={14} stroke={1.6} />
        </ActionIcon>
      </Tooltip>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title={name} desktopSize="sm">
        <Stack gap="sm">
          <TextInput
            label="Фактическая сумма на счёте"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            className="money"
            autoFocus
            error={value.trim() !== '' && parsed == null ? 'Не разбирается как сумма' : undefined}
            description="Копейки — через запятую; можно выражением: 250000-1500"
          />
          {parsed != null && (
            <Text fz="sm" c="dimmed" className="money">
              Будет зафиксировано: {fmtMoneyExact(parsed)}
            </Text>
          )}
          <DatePickerInput
            label="На дату"
            value={date}
            onChange={(v) => setDate(v ? String(v).slice(0, 10) : null)}
            valueFormat="D MMMM YYYY"
            popoverProps={{ shadow: 'md' }}
          />
          <Text fz="xs" c="dimmed">
            Вычислено сейчас: {fmtMoney(current)} · баланс будут менять только операции после этой
            даты
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpened(false)}>
              Отмена
            </Button>
            <Button onClick={save} loading={pending} disabled={parsed == null}>
              Зафиксировать
            </Button>
          </Group>
        </Stack>
      </FormDrawer>
    </>
  );
}
