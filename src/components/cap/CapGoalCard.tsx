'use client';

import { useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Progress,
  Select,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { spendCapGoal, toggleCapContribution } from '@/actions/cap';
import type { CapGoalOverview } from '@/queries/cap';
import { Money } from '@/components/Money';
import { fmtMoney, round2 } from '@/lib/money';
import { RU_MONTH_SHORT, dateShort } from '@/lib/dates';
import { todayLocalISO } from '@/components/assets/today';

const STATUS_META: Record<
  CapGoalOverview['status'],
  { label: string; color: string }
> = {
  not_started: { label: 'не начато', color: 'gray' },
  in_progress: { label: 'в процессе', color: 'blue' },
  behind: { label: 'не хватает', color: 'orange' },
  waiting: { label: 'ждёт', color: 'teal' },
  ready: { label: 'можно тратить', color: 'ink' },
  spent: { label: 'потрачено', color: 'gray' },
};

export function CapGoalCard({
  goal,
  year,
  currentYm,
  otherGoals,
  returnAccounts,
}: {
  goal: CapGoalOverview;
  year: number;
  currentYm: string;
  otherGoals: { id: number; name: string; remaining: number }[];
  returnAccounts: { id: number; name: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [spendOpen, setSpendOpen] = useState(false);
  const meta = STATUS_META[goal.status];
  const pct = goal.target > 0 ? Math.min(100, (goal.contributed / goal.target) * 100) : 0;

  const toggle = (ym: string) =>
    startTransition(async () => {
      const res = await toggleCapContribution({ goalId: goal.id, ym });
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
    });

  return (
    <Card>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600} fz="sm" style={{ lineHeight: 1.3 }}>
            {goal.name}
          </Text>
          <Badge variant="light" color={meta.color} size="sm" style={{ flexShrink: 0 }}>
            {meta.label}
            {goal.status === 'behind' && ` −${fmtMoney(goal.behindAmount)}`}
          </Badge>
        </Group>

        <Progress value={pct} size={8} radius="xl" color={goal.status === 'behind' ? 'orange' : 'ink'} />
        <Group justify="space-between">
          <Text fz="xs" c="dimmed" className="money">
            {fmtMoney(goal.contributed)} из {fmtMoney(goal.target)}
          </Text>
          <Text fz="xs" c="dimmed" className="money">
            взнос {fmtMoney(goal.monthly)}/мес
          </Text>
        </Group>

        {goal.status !== 'spent' && (
          <Group gap={4} wrap="wrap">
            {RU_MONTH_SHORT.map((label, i) => {
              const ym = `${year}-${String(i + 1).padStart(2, '0')}`;
              const flag = goal.monthsFlags[ym];
              const isFuture = ym > currentYm;
              const checked = !!flag;
              return (
                <Tooltip
                  key={ym}
                  label={
                    checked
                      ? `${fmtMoney(flag!.amount)}${flag!.sent ? ' · отправлен' : ' · не отправлен'}`
                      : 'Отметить взнос'
                  }
                >
                  <UnstyledButton
                    onClick={() => !isFuture && toggle(ym)}
                    disabled={isFuture || pending}
                    aria-label={`Взнос за месяц ${i + 1}`}
                    style={{
                      width: 26,
                      height: 24,
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: checked
                        ? flag!.sent
                          ? 'var(--mantine-color-ink-7)'
                          : 'var(--mantine-color-ink-1)'
                        : 'var(--mantine-color-gray-1)',
                      color: checked
                        ? flag!.sent
                          ? '#fff'
                          : 'var(--mantine-color-ink-8)'
                        : isFuture
                          ? 'var(--mantine-color-gray-4)'
                          : 'var(--mantine-color-gray-6)',
                      cursor: isFuture ? 'default' : 'pointer',
                    }}
                  >
                    {label}
                  </UnstyledButton>
                </Tooltip>
              );
            })}
          </Group>
        )}

        {goal.status === 'waiting' && goal.waitUntil && (
          <Text fz="xs" c="teal.8">
            Цель достигнута — ждёт до {dateShort(goal.waitUntil)}, чтобы месяц последнего взноса
            зачёлся.
          </Text>
        )}
        {(goal.status === 'ready' || goal.status === 'waiting') && (
          <Group>
            <Button
              size="compact-sm"
              variant={goal.status === 'ready' ? 'filled' : 'light'}
              onClick={() => setSpendOpen(true)}
            >
              Потратить…
            </Button>
          </Group>
        )}
        {goal.spentAt && (
          <Text fz="xs" c="dimmed">
            потрачено {dateShort(goal.spentAt)}
          </Text>
        )}
      </Stack>
      <SpendModal
        goal={goal}
        opened={spendOpen}
        onClose={() => setSpendOpen(false)}
        otherGoals={otherGoals}
        returnAccounts={returnAccounts}
      />
    </Card>
  );
}

function SpendModal({
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

  const distributed = round2(
    targets.reduce((s, t) => s + (typeof t.amount === 'number' ? t.amount : Number(t.amount) || 0), 0),
  );
  const diff = round2(goal.contributed - distributed);

  const submit = () =>
    startTransition(async () => {
      const res = await spendCapGoal({
        goalId: goal.id,
        date: todayLocalISO(),
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
        date: todayLocalISO(),
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

  const [returnAccountId, setReturnAccountId] = useState<string | null>(null);

  return (
    <Modal opened={opened} onClose={onClose} title={`Потратить КАП: ${goal.name}`} centered size="md">
      <Stack gap="sm">
        <Text fz="sm">
          Накоплено <Money value={goal.contributed} fw={600} />
        </Text>
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
                    label: `${g.name} (ост. ${fmtMoney(g.remaining)})`,
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
                {Math.abs(diff) > 0.01 ? `осталось распределить ${fmtMoney(diff)}` : 'распределено полностью ✓'}
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
    </Modal>
  );
}
