'use client';

import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import { IconX } from '@tabler/icons-react';
import { deleteFundMovement, extraTopupFund, topupFund } from '@/actions/fund';
import { ReimburseForm } from '@/components/day/ReimburseForm';
import { todayLocalISO } from '@/components/assets/today';
import { Money } from '@/components/Money';
import { fmtMoney } from '@/lib/money';
import { dateShort } from '@/lib/dates';
import type { FundMovementRow } from '@/queries/fund';

export function FundToolbar({
  planTotal,
  offsetsTotal,
  toTransfer,
  accounts,
  defaultAccountId,
  fundCategories,
}: {
  planTotal: number;
  offsetsTotal: number;
  toTransfer: number;
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
  fundCategories: { id: number; name: string; groupName: string }[];
}) {
  const [topupOpen, setTopupOpen] = useState(false);
  const [reimburseOpen, setReimburseOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);

  return (
    <Group gap="xs">
      <Button onClick={() => setTopupOpen(true)}>Пополнить по плану</Button>
      <Button variant="light" onClick={() => setReimburseOpen(true)}>
        Компенсация…
      </Button>
      <Button variant="subtle" onClick={() => setExtraOpen(true)}>
        Внеплановое пополнение
      </Button>

      <TopupModal
        opened={topupOpen}
        onClose={() => setTopupOpen(false)}
        planTotal={planTotal}
        offsetsTotal={offsetsTotal}
        toTransfer={toTransfer}
        accounts={accounts}
        defaultAccountId={defaultAccountId}
      />
      <FormDrawer
        opened={reimburseOpen}
        onClose={() => setReimburseOpen(false)}
        title="Компенсация из КС"
      >
        <ReimburseWithDate fundCategories={fundCategories} />
      </FormDrawer>
      <ExtraTopupModal
        opened={extraOpen}
        onClose={() => setExtraOpen(false)}
        accounts={accounts}
        fundCategories={fundCategories}
      />
    </Group>
  );
}

function TopupModal({
  opened,
  onClose,
  planTotal,
  offsetsTotal,
  toTransfer,
  accounts,
  defaultAccountId,
}: {
  opened: boolean;
  onClose: () => void;
  planTotal: number;
  offsetsTotal: number;
  toTransfer: number;
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
}) {
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [date, setDate] = useState<string>(todayLocalISO());
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await topupFund({ date, fromAccountId: Number(accountId) });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Фонд пополнен по плану' });
        onClose();
      }
    });

  return (
    <FormDrawer opened={opened} onClose={onClose} title="Пополнение КС по плану">
      <Stack gap="sm">
        <DatePickerInput
          label="Дата"
          value={date}
          onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
          valueFormat="D MMMM YYYY"
          maw={220}
          popoverProps={{ shadow: 'md' }}
        />
        <Table verticalSpacing={4} fz="sm">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td px={0}>План по статьям</Table.Td>
              <Table.Td px={0} ta="right">
                <Money value={planTotal} fz="sm" />
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td px={0}>Зачтённые компенсации</Table.Td>
              <Table.Td px={0} ta="right">
                <Money value={-offsetsTotal} fz="sm" c={offsetsTotal ? 'red.8' : undefined} />
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td px={0}>
                <Text fw={700} fz="sm">
                  К переводу на счёт КС
                </Text>
              </Table.Td>
              <Table.Td px={0} ta="right">
                <Money value={toTransfer} fw={700} fz="sm" />
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
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending} disabled={!accountId}>
            Пополнить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

function ExtraTopupModal({
  opened,
  onClose,
  accounts,
  fundCategories,
}: {
  opened: boolean;
  onClose: () => void;
  accounts: { id: number; name: string }[];
  fundCategories: { id: number; name: string; groupName: string }[];
}) {
  const [fundCategoryId, setFundCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState<string>(todayLocalISO());
  const [accountId, setAccountId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = [...new Set(fundCategories.map((c) => c.groupName))];
  const data = groups.map((g) => ({
    group: g,
    items: fundCategories
      .filter((c) => c.groupName === g)
      .map((c) => ({ value: String(c.id), label: c.name })),
  }));

  const submit = () =>
    startTransition(async () => {
      const res = await extraTopupFund({
        date,
        fundCategoryId: Number(fundCategoryId),
        amount,
        fromAccountId: accountId ? Number(accountId) : null,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Статья пополнена' });
        onClose();
        setAmount('');
      }
    });

  return (
    <FormDrawer opened={opened} onClose={onClose} title="Внеплановое пополнение статьи">
      <Stack gap="sm">
        <DatePickerInput
          label="Дата"
          value={date}
          onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
          valueFormat="D MMMM YYYY"
          maw={220}
          popoverProps={{ shadow: 'md' }}
        />
        <Select label="Статья" data={data} value={fundCategoryId} onChange={setFundCategoryId} searchable />
        <TextInput
          label="Сумма"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
        />
        <Select
          label="Банковский перевод со счёта (необязательно)"
          placeholder="Без перевода — только учёт"
          data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
          value={accountId}
          onChange={setAccountId}
          clearable
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending} disabled={!amount || !fundCategoryId}>
            Пополнить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

const KIND_LABEL: Record<string, string> = {
  plan_topup: 'пополнение по плану',
  extra_topup: 'внеплановое пополнение',
  reimbursement: 'компенсация',
  adjustment: 'корректировка',
};

export function FundMovementsList({ movements }: { movements: FundMovementRow[] }) {
  const [pending, startTransition] = useTransition();

  const remove = (id: number) =>
    startTransition(async () => {
      const res = await deleteFundMovement(id);
      if (!res.ok) notifications.show({ color: 'red', message: res.error });
    });

  if (movements.length === 0) {
    return (
      <Text fz="sm" c="dimmed">
        Движений пока нет
      </Text>
    );
  }
  return (
    <Stack gap={0}>
      {movements.map((m) => (
        <Group
          key={m.id}
          justify="space-between"
          wrap="nowrap"
          py={6}
          style={{ borderBottom: '1px solid var(--ink-line)', opacity: pending ? 0.5 : 1 }}
        >
          <Stack gap={0} style={{ minWidth: 0 }}>
            <Text fz="sm" truncate>
              {dateShort(m.date)} · {m.categoryName}
              {m.settle === 'offset_next_topup' && !m.offsetAppliedAt && (
                <Text span fz="xs" c="orange.8">
                  {' '}
                  · к зачёту
                </Text>
              )}
            </Text>
            <Text fz="xs" c="dimmed" truncate>
              {KIND_LABEL[m.kind] ?? m.kind}
              {m.note ? ` · ${m.note}` : ''}
            </Text>
          </Stack>
          <Group gap={4} wrap="nowrap">
            <Text fz="sm" className="money" c={m.amount < 0 ? undefined : 'ink.7'}>
              {m.amount > 0 ? '+' : ''}
              {fmtMoney(m.amount)}
            </Text>
            <Tooltip label="Удалить">
              <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => remove(m.id)}>
                <IconX size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}


/** Компенсация со страницы КС: с выбором даты (на странице дня дата задана днём). */
function ReimburseWithDate({
  fundCategories,
}: {
  fundCategories: { id: number; name: string; groupName: string }[];
}) {
  const [date, setDate] = useState<string>(todayLocalISO());
  return (
    <Stack gap="sm">
      <DatePickerInput
        label="Дата"
        value={date}
        onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
        valueFormat="D MMMM YYYY"
        maw={220}
        popoverProps={{ shadow: 'md' }}
      />
      <ReimburseForm key={date} date={date} fundCategories={fundCategories} />
    </Stack>
  );
}
