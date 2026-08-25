'use client';

import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  NumberInput,
  Select,
  Stack,
  TableTd,
  TableTr,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import { spendCapGoal, toggleCapContribution } from '@/actions/cap';
import type { CapGoalOverview } from '@/queries/cap';
import { Money } from '@/components/Money';
import { fmtMoneyExact, round2 } from '@/lib/money';
import { RU_MONTH_SHORT, dateShort, ymOf } from '@/lib/dates';
import { todayLocalISO } from '@/components/assets/today';

const STATUS_META: Record<CapGoalOverview['status'], { label: string; color: string }> = {
  not_started: { label: 'не начато', color: 'gray' },
  in_progress: { label: 'в процессе', color: 'blue' },
  behind: { label: 'не хватает', color: 'orange' },
  waiting: { label: 'ждёт', color: 'teal' },
  ready: { label: 'можно тратить', color: 'ink' },
  spent: { label: 'потрачено', color: 'gray' },
};

export function CapGoalRow({
  goal,
  currentYm,
  otherGoals,
  returnAccounts,
}: {
  goal: CapGoalOverview;
  currentYm: string;
  otherGoals: { id: number; name: string; remaining: number }[];
  returnAccounts: { id: number; name: string }[];
}) {
  const [, startTransition] = useTransition();
  const [spendOpen, setSpendOpen] = useState(false);
  const [busyYm, setBusyYm] = useState<string | null>(null);
  const meta = STATUS_META[goal.status];

  const toggle = (ym: string) => {
    setBusyYm(ym);
    startTransition(async () => {
      const res = await toggleCapContribution({ goalId: goal.id, ym });
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
      setBusyYm(null);
    });
  };

  // флажки: все годы с начала амортизации, каждый ряд — полные 12 месяцев;
  // месяцы до покупки и будущие — неактивны
  const startYm = goal.startDate ? ymOf(goal.startDate) : (goal.firstOwnYm ?? currentYm);
  const startYear = Number(startYm.slice(0, 4));
  const currentYear = Number(currentYm.slice(0, 4));
  const years = Array.from(
    { length: currentYear - Math.min(startYear, currentYear) + 1 },
    (_, i) => Math.min(startYear, currentYear) + i,
  );

  return (
    <TableTr>
      <TableTd>
        <Text fz="sm" fw={500} truncate>
          {goal.name}
        </Text>
        {goal.startDate && (
          <Text fz="xs" c="dimmed" className="money">
            с {dateShort(goal.startDate)}
          </Text>
        )}
      </TableTd>
      <TableTd ta="right">
        <Money value={goal.monthly} fz="sm" exact />
      </TableTd>
      <TableTd ta="right">
        <Money value={goal.contributed} fz="sm" exact />
      </TableTd>
      <TableTd ta="right">
        <Money value={goal.remaining} fz="sm" exact c={goal.remaining >= 1 ? undefined : 'dimmed'} />
      </TableTd>
      <TableTd ta="right">
        <Money value={goal.target} fz="sm" fw={600} exact />
      </TableTd>
      <TableTd>
        {/* узкая колонка: сумма недостачи и кнопка — отдельными строками под бейджем */}
        <Stack gap={4} align="center">
          <Badge variant="light" color={meta.color} size="sm">
            {meta.label}
          </Badge>
          {goal.status === 'behind' && (
            <Text fz="xs" c="orange.8" className="money">
              −{fmtMoneyExact(goal.behindAmount)}
            </Text>
          )}
          {(goal.status === 'ready' || goal.status === 'waiting') && (
            <Button size="compact-xs" variant={goal.status === 'ready' ? 'filled' : 'light'} onClick={() => setSpendOpen(true)}>
              Потратить…
            </Button>
          )}
        </Stack>
      </TableTd>
      <TableTd>
        {/* по правому краю: контент фиксированной ширины → колонки месяцев совпадают между группами */}
        <Group gap={8} wrap="wrap" justify="flex-end" style={{ rowGap: 4 }}>
          {years.map((year) => (
            <Group key={year} gap={3} wrap="nowrap">
              {/* слот метки года фиксированной ширины — фишки месяцев ровные во всех строках */}
              <Text fz={10} c="dimmed" className="money" w={18} ta="right" style={{ flexShrink: 0 }}>
                {years.length > 1 ? `’${String(year).slice(2)}` : ''}
              </Text>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const ym = `${year}-${String(m).padStart(2, '0')}`;
                const flag = goal.monthsFlags[ym];
                // до покупки и в будущем взнос невозможен — флажок заблокирован
                const locked = ym < startYm || ym > currentYm;
                const checked = !!flag && (flag.amount > 0 || flag.inflow > 0);
                // месяц «закрыт», когда поступления (взнос + перетоки) покрыли месячный КАП
                const total = flag ? round2(flag.amount + flag.inflow) : 0;
                const coveredByInflow = !!flag && !flag.sent && flag.inflow > 0 && total >= goal.monthly - 1;
                const dark = !!flag && (flag.sent || coveredByInflow);
                return (
                  <Tooltip
                    key={ym}
                    label={
                      checked
                        ? `${fmtMoneyExact(total)}${
                            flag!.sent
                              ? ' · отправлен'
                              : coveredByInflow
                                ? ' · закрыт перераспределением'
                                : ' · не отправлен'
                          }`
                        : locked
                          ? ym < startYm
                            ? 'До покупки'
                            : 'Будущий месяц'
                          : 'Отметить взнос'
                    }
                  >
                    <UnstyledButton
                      onClick={() => !locked && toggle(ym)}
                      disabled={locked || busyYm !== null}
                      aria-label={`Взнос ${ym}`}
                      style={{
                        width: 24,
                        height: 22,
                        borderRadius: 6,
                        fontSize: 10,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: checked
                          ? dark
                            ? 'var(--mantine-color-ink-7)'
                            : 'var(--mantine-color-ink-1)'
                          : locked
                            ? 'var(--mantine-color-gray-0)'
                            : 'var(--mantine-color-gray-1)',
                        color: checked
                          ? dark
                            ? '#fff'
                            : 'var(--mantine-color-ink-8)'
                          : locked
                            ? 'var(--mantine-color-gray-4)'
                            : 'var(--mantine-color-gray-6)',
                        cursor: locked ? 'default' : 'pointer',
                      }}
                    >
                      {busyYm === ym ? (
                        <Loader size={11} color={dark ? 'white' : 'ink'} />
                      ) : (
                        RU_MONTH_SHORT[m - 1]
                      )}
                    </UnstyledButton>
                  </Tooltip>
                );
              })}
            </Group>
          ))}
        </Group>
      </TableTd>
      <SpendDrawer
        goal={goal}
        opened={spendOpen}
        onClose={() => setSpendOpen(false)}
        otherGoals={otherGoals}
        returnAccounts={returnAccounts}
      />
    </TableTr>
  );
}

export function SpendDrawer({
  goal,
  opened,
  onClose,
  otherGoals,
  returnAccounts,
}: {
  goal: CapGoalOverview;
  opened: boolean;
  onClose: () => void;
  otherGoals: { id: number; name: string; remaining: number }[];
  returnAccounts: { id: number; name: string }[];
}) {
  const [mode, setMode] = useState<'transfer' | 'return'>('transfer');
  const [targets, setTargets] = useState<{ goalId: string | null; amount: number | string }[]>([
    { goalId: null, amount: goal.contributed },
  ]);
  const [pending, startTransition] = useTransition();
  const [returnAccountId, setReturnAccountId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayLocalISO());

  const distributed = round2(
    targets.reduce((s, t) => s + (typeof t.amount === 'number' ? t.amount : Number(t.amount) || 0), 0),
  );
  const diff = round2(goal.contributed - distributed);

  const submit = () =>
    startTransition(async () => {
      const res = await spendCapGoal({
        goalId: goal.id,
        date,
        mode,
        toAccountId: null,
        targets:
          mode === 'transfer'
            ? targets
                .filter((t) => t.goalId)
                .map((t) => ({ goalId: Number(t.goalId), amount: Number(t.amount) || 0 }))
            : undefined,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'КАП распределён' });
        onClose();
      }
    });

  const submitReturn = () =>
    startTransition(async () => {
      const res = await spendCapGoal({
        goalId: goal.id,
        date,
        mode: 'return',
        toAccountId: returnAccountId ? Number(returnAccountId) : null,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'КАП возвращён на счёт' });
        onClose();
      }
    });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={`Потратить КАП: ${goal.name}`}>
      <Stack gap="sm">
        <Text fz="sm">
          Накоплено <Money value={goal.contributed} fw={600} exact />
        </Text>
        <DatePickerInput
          label="Дата"
          value={date}
          onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
          valueFormat="D MMMM YYYY"
          maw={220}
          popoverProps={{ shadow: 'md' }}
        />
        <Group gap="xs">
          <Button
            size="compact-sm"
            variant={mode === 'transfer' ? 'filled' : 'default'}
            onClick={() => setMode('transfer')}
          >
            В другие КАП
          </Button>
          <Button
            size="compact-sm"
            variant={mode === 'return' ? 'filled' : 'default'}
            onClick={() => setMode('return')}
          >
            Вернуть на счёт
          </Button>
        </Group>

        {mode === 'transfer' ? (
          <>
            {targets.map((t, i) => (
              <Group key={i} gap="xs" align="flex-end" wrap="nowrap">
                <Select
                  label={i === 0 ? 'Цель-получатель' : undefined}
                  placeholder="Выберите цель"
                  data={otherGoals.map((g) => ({
                    value: String(g.id),
                    label: `${g.name} (ост. ${fmtMoneyExact(g.remaining)})`,
                  }))}
                  value={t.goalId}
                  onChange={(v) => {
                    const next = [...targets];
                    next[i] = { ...next[i], goalId: v };
                    setTargets(next);
                  }}
                  style={{ flex: 1 }}
                  searchable
                />
                <NumberInput
                  label={i === 0 ? 'Сумма' : undefined}
                  value={t.amount}
                  onChange={(v) => {
                    const next = [...targets];
                    next[i] = { ...next[i], amount: v };
                    setTargets(next);
                  }}
                  w={130}
                  hideControls
                  decimalScale={2}
                />
              </Group>
            ))}
            <Group justify="space-between">
              <Button
                size="compact-xs"
                variant="subtle"
                onClick={() => setTargets([...targets, { goalId: null, amount: Math.max(diff, 0) }])}
              >
                + получатель
              </Button>
              <Text fz="xs" c={Math.abs(diff) > 0.01 ? 'orange.8' : 'dimmed'} className="money">
                {Math.abs(diff) > 0.01 ? `осталось распределить ${fmtMoneyExact(diff)}` : 'распределено полностью ✓'}
              </Text>
            </Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Отмена
              </Button>
              <Button onClick={submit} loading={pending} disabled={Math.abs(diff) > 0.01}>
                Распределить
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Select
              label="Счёт возврата"
              data={returnAccounts.map((a) => ({ value: String(a.id), label: a.name }))}
              value={returnAccountId}
              onChange={setReturnAccountId}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Отмена
              </Button>
              <Button onClick={submitReturn} loading={pending} disabled={!returnAccountId}>
                Вернуть
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </FormDrawer>
  );
}
