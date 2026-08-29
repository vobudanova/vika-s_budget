'use client';

import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import {
  IconDotsVertical,
  IconPencil,
  IconTag,
  IconPlayerStop,
  IconArrowBackUp,
  IconTargetOff,
  IconTrash,
  IconPlus,
} from '@tabler/icons-react';
import { deleteAsset, disposeAsset, editAsset, resaleAsset, undisposeAsset } from '@/actions/assets';
import { removeCapGoalForAsset } from '@/actions/cap';
import { todayLocalISO } from './today';
import { PurchaseForm } from '@/components/day/PurchaseForm';
import { confirmDanger } from '@/lib/confirm';
import { fmtMoney } from '@/lib/money';

export function NewPurchaseButton(props: {
  assetCategories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
  inflationRate: number;
}) {
  const [opened, setOpened] = useState(false);
  const [date, setDate] = useState<string>(todayLocalISO());
  return (
    <>
      <Button leftSection={<IconPlus size={16} />} onClick={() => setOpened(true)}>
        Новая покупка
      </Button>
      <FormDrawer opened={opened} onClose={() => setOpened(false)} title="Новая покупка" desktopSize="lg">
        <Stack gap="sm">
          <DatePickerInput
            label="Дата покупки"
            value={date}
            onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
            valueFormat="D MMMM YYYY"
            maw={220}
            popoverProps={{ shadow: 'md' }}
          />
          <PurchaseForm key={date} date={date} {...props} />
        </Stack>
      </FormDrawer>
    </>
  );
}

export type AssetEditInit = {
  name: string;
  date: string;
  price: number;
  termMonths: number;
  assetCategoryId: number;
};

export function AssetActions({
  assetId,
  name,
  disposed,
  hasCap = false,
  capAccumulated = 0,
  accounts,
  editInit,
  assetCategories = [],
}: {
  assetId: number;
  name: string;
  disposed: boolean;
  hasCap?: boolean;
  /** накоплено по цели КАП — при удалении перетечёт в другие цели */
  capAccumulated?: number;
  accounts: { id: number; name: string }[];
  editInit?: AssetEditInit;
  assetCategories?: { id: number; name: string }[];
}) {
  const [resaleOpen, setResaleOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeDate, setDisposeDate] = useState<string>(todayLocalISO());

  const dispose = () =>
    startTransition(async () => {
      const res = await disposeAsset({ assetId, date: disposeDate });
      notifications.show(
        res.ok
          ? { message: `«${name}» — амортизация остановлена` }
          : { color: 'red', message: res.error },
      );
      if (res.ok) setDisposeOpen(false);
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
      message:
        capAccumulated > 0.005
          ? `Цель КАП для «${name}» будет удалена, амортизация продолжится. Накопленные ${fmtMoney(capAccumulated)} не пропадут — перетекут в другие цели, закрывая самые ранние незакрытые месяцы.`
          : `Цель КАП для «${name}» будет удалена, статус станет «не применимо». Амортизация продолжится.`,
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
      message:
        capAccumulated > 0.005
          ? `Покупка «${name}», график амортизации и цель КАП будут удалены. Накопленные по цели ${fmtMoney(capAccumulated)} не пропадут — перетекут в другие цели, закрывая самые ранние незакрытые месяцы (как обычные перетоки).`
          : `Удалить покупку «${name}» вместе с графиком амортизации и КАП?`,
      onConfirm: () =>
        startTransition(async () => {
          const res = await deleteAsset(assetId);
          notifications.show(
            res.ok
              ? {
                  message:
                    capAccumulated > 0.005
                      ? `Покупка удалена, ${fmtMoney(capAccumulated)} перетекли в другие цели`
                      : 'Покупка удалена',
                }
              : { color: 'red', message: res.error },
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
          {editInit && (
            <Menu.Item leftSection={<IconPencil size={15} />} onClick={() => setEditOpen(true)}>
              Редактировать…
            </Menu.Item>
          )}
          <Menu.Item leftSection={<IconTag size={15} />} onClick={() => setResaleOpen(true)}>
            Перепродажа…
          </Menu.Item>
          {disposed ? (
            <Menu.Item leftSection={<IconArrowBackUp size={15} />} onClick={undispose}>
              Возобновить амортизацию
            </Menu.Item>
          ) : (
            <Menu.Item leftSection={<IconPlayerStop size={15} />} onClick={() => setDisposeOpen(true)}>
              Завершить досрочно…
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
      {editInit && (
        <EditAssetDrawer
          assetId={assetId}
          init={editInit}
          assetCategories={assetCategories}
          opened={editOpen}
          onClose={() => setEditOpen(false)}
        />
      )}
      <FormDrawer
        opened={disposeOpen}
        onClose={() => setDisposeOpen(false)}
        title={`Завершить досрочно: ${name}`}
        desktopSize="sm"
      >
        <Stack gap="sm">
          <DatePickerInput
            label="Дата завершения"
            value={disposeDate}
            onChange={(v) => setDisposeDate(v ? String(v).slice(0, 10) : todayLocalISO())}
            valueFormat="D MMMM YYYY"
            popoverProps={{ shadow: 'md' }}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDisposeOpen(false)}>
              Отмена
            </Button>
            <Button onClick={dispose} loading={pending}>
              Завершить
            </Button>
          </Group>
        </Stack>
      </FormDrawer>
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
  const [date, setDate] = useState<string>(todayLocalISO());
  const [accountId, setAccountId] = useState<string | null>(
    accounts[0] ? String(accounts[0].id) : null,
  );
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await resaleAsset({
        assetId,
        date,
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
        <DatePickerInput
          label="Дата продажи"
          value={date}
          onChange={(v) => setDate(v ? String(v).slice(0, 10) : todayLocalISO())}
          valueFormat="D MMMM YYYY"
          popoverProps={{ shadow: 'md' }}
        />
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


function EditAssetDrawer({
  assetId,
  init,
  assetCategories,
  opened,
  onClose,
}: {
  assetId: number;
  init: AssetEditInit;
  assetCategories: { id: number; name: string }[];
  opened: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(init.name);
  const [date, setDate] = useState<string>(init.date);
  const [price, setPrice] = useState<string>(String(init.price));
  const [term, setTerm] = useState<number | string>(init.termMonths);
  const [categoryId, setCategoryId] = useState<string | null>(String(init.assetCategoryId));
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await editAsset({
        assetId,
        name,
        date,
        price,
        termMonths: Number(term),
        assetCategoryId: Number(categoryId),
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: 'Покупка обновлена: график и КАП пересчитаны' });
        onClose();
      }
    });

  return (
    <FormDrawer opened={opened} onClose={onClose} title={`Редактировать: ${init.name}`}>
      <Stack gap="sm">
        <TextInput label="Наименование" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Group gap="xs" grow>
          <TextInput
            label="Цена"
            value={price}
            onChange={(e) => setPrice(e.currentTarget.value)}
            className="money"
            inputMode="decimal"
          />
          <NumberInput label="Срок, мес" value={term} onChange={setTerm} min={1} max={120} />
        </Group>
        <DatePickerInput
          label="Дата покупки"
          value={date}
          onChange={(v) => setDate(v ? String(v).slice(0, 10) : init.date)}
          valueFormat="D MMMM YYYY"
          popoverProps={{ shadow: 'md' }}
        />
        <Select
          label="Категория актива"
          data={assetCategories.map((c) => ({ value: String(c.id), label: c.name }))}
          value={categoryId}
          onChange={setCategoryId}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={submit} loading={pending} disabled={!name || !price || !categoryId}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}
