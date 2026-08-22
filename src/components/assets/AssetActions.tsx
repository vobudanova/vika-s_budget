'use client';

import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import {
  IconDotsVertical,
  IconTag,
  IconPlayerStop,
  IconArrowBackUp,
  IconTargetOff,
  IconTrash,
  IconPlus,
} from '@tabler/icons-react';
import { deleteAsset, disposeAsset, resaleAsset, undisposeAsset } from '@/actions/assets';
import { removeCapGoalForAsset } from '@/actions/cap';
import { todayLocalISO } from './today';
import { PurchaseForm } from '@/components/day/PurchaseForm';
import { confirmDanger } from '@/lib/confirm';

export function NewPurchaseButton(props: {
  assetCategories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
  inflationRate: number;
}) {
  const [opened, setOpened] = useState(false);
  return (
    <>
      <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
        Новая покупка
      </Button>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title="Новая покупка" desktopSize="lg">
        <PurchaseForm date={todayLocalISO()} {...props} />
      </FormDrawer>
    </>
  );
}

export function AssetActions({
  assetId,
  name,
  disposed,
  hasCap = false,
  accounts,
}: {
  assetId: number;
  name: string;
  disposed: boolean;
  hasCap?: boolean;
  accounts: { id: number; name: string }[];
}) {
  const [resaleOpen, setResaleOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const dispose = () =>
    startTransition(async () => {
      const res = await disposeAsset({ assetId, date: todayLocalISO() });
      notifications.show(
        res.ok
          ? { message: `«${name}» — амортизация остановлена сегодняшним днём` }
          : { color: 'red', message: res.error },
      );
    });

  const undispose = () =>
    startTransition(async () => {
      const res = await undisposeAsset(assetId);
      notifications.show(
        res.ok ? { message: 'Амортизация возобновлена' } : { color: 'red', message: res.error },
      );
    });

  const removeCap = () =>
    confirmDanger({
      title: 'Отключить КАП',
      message: `Цель КАП для «${name}» будет удалена, статус станет «не применимо». Амортизация продолжится.`,
      confirmLabel: 'Отключить',
      onConfirm: () =>
        startTransition(async () => {
          const res = await removeCapGoalForAsset(assetId);
          notifications.show(
            res.ok ? { message: 'КАП отключён' } : { color: 'red', message: res.error },
          );
        }),
    });

  const remove = () =>
    confirmDanger({
      title: 'Удалить покупку',
      message: `Удалить покупку «${name}» вместе с графиком амортизации и КАП?`,
      onConfirm: () =>
        startTransition(async () => {
          const res = await deleteAsset(assetId);
          notifications.show(
            res.ok ? { message: 'Покупка удалена' } : { color: 'red', message: res.error },
          );
        }),
    });

  return (
    <>
      <Menu shadow="md" position="bottom-end">
        <Menu.Target>
          <ActionIcon variant="subtle" color="gray" loading={pending} aria-label="Действия">
            <IconDotsVertical size={16} />
          </ActionIcon>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item leftSection={<IconTag size={15} />} onClick={() => setResaleOpen(true)}>
            Перепродажа…
          </Menu.Item>
          {disposed ? (
            <Menu.Item leftSection={<IconArrowBackUp size={15} />} onClick={undispose}>
              Возобновить амортизацию
            </Menu.Item>
          ) : (
            <Menu.Item leftSection={<IconPlayerStop size={15} />} onClick={dispose}>
              Завершить досрочно
            </Menu.Item>
          )}
          {hasCap && (
            <Menu.Item leftSection={<IconTargetOff size={15} />} onClick={removeCap}>
              Отключить КАП
            </Menu.Item>
          )}
          <Menu.Divider />
          <Menu.Item color="red" leftSection={<IconTrash size={15} />} onClick={remove}>
            Удалить
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      <ResaleModal
        assetId={assetId}
        name={name}
        opened={resaleOpen}
        onClose={() => setResaleOpen(false)}
        accounts={accounts}
      />
    </>
  );
}

function ResaleModal({
  assetId,
  name,
  opened,
  onClose,
  accounts,
}: {
  assetId: number;
  name: string;
  opened: boolean;
  onClose: () => void;
  accounts: { id: number; name: string }[];
}) {
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<string | null>(
    accounts[0] ? String(accounts[0].id) : null,
  );
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await resaleAsset({
        assetId,
        date: todayLocalISO(),
        amount,
        counterAccountId: Number(accountId),
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Перепродажа записана: база и КАП пересчитаны' });
        onClose();
        setAmount('');
      }
    });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={`Перепродажа: ${name}`}>
      <Stack gap="sm">
        <TextInput
          label="Сумма продажи"
          placeholder="2 208"
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
        />
        <Select
          label="Куда пришли деньги"
          data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
          value={accountId}
          onChange={setAccountId}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending} disabled={!amount}>
            Записать
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}
