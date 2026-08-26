'use client';

import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Switch,
  NumberInput,
  Select,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { FormDrawer } from '@/components/FormDrawer';
import { IconArchive, IconArchiveOff, IconCheck, IconChevronDown, IconChevronUp, IconPencil, IconTrash } from '@tabler/icons-react';
import {
  archiveCategory,
  createAccount,
  createCategory,
  createFundCategory,
  createIncomeSource,
  deleteAccount,
  deleteIncomeSource,
  deleteCategoryHard,
  getCategoryUsage,
  renameAccount,
  moveAssetCategory,
  renameAssetCategory,
  setAccountInTotal,
  updateCategory,
  renameIncomeSource,
  setCategoryPendingDelete,
  toggleAccountActive,
  unarchiveCategory,
  updateFundPlan,
  updateFundCategory,
  deleteFundCategory,
  updateIncomeExpected,
  type CategoryUsage,
} from '@/actions/reference';
import { saveSetting } from '@/actions/misc';
import { confirmDanger } from '@/lib/confirm';

type Cat = {
  id: number;
  groupId: number;
  name: string;
  activeFrom: string;
  activeTo: string | null;
  pendingDelete: boolean;
};
type Grp = { id: number; name: string };
type FundCat = {
  id: number;
  name: string;
  groupName: string;
  monthlyPlan: number;
  activeFrom: string;
  activeTo: string | null;
};
type Source = { id: number; name: string; type: string; expectedMonthly: number | null };
type Account = { id: number; name: string; type: string; isActive: boolean; includeInTotal: boolean };

/** Компактная подпись срока действия («с 03.2025 по 06.2026») и признак
    «не действует в текущем году» — состав категорий и статей меняется по годам. */
const periodLabel = (from: string, to: string | null) => {
  const mmYYYY = (d: string) => `${d.slice(5, 7)}.${d.slice(0, 4)}`;
  return [from > '2001-01-01' ? `с ${mmYYYY(from)}` : null, to ? `по ${mmYYYY(to)}` : null]
    .filter(Boolean)
    .join(' ');
};
const outsideCurrentYear = (from: string, to: string | null) => {
  const y = String(new Date().getFullYear());
  return from > `${y}-12-31` || (!!to && to < `${y}-01-01`);
};

const notify = (res: { ok: boolean; error?: string }, okMsg: string) =>
  notifications.show(
    res.ok ? { message: okMsg } : { color: 'red', message: res.error ?? 'Ошибка' },
  );

export function SettingsPanels({
  inflationRate,
  groups,
  categories,
  fundCategories,
  sources,
  accounts,
  assetCategories,
}: {
  inflationRate: number;
  groups: Grp[];
  categories: Cat[];
  fundCategories: FundCat[];
  sources: Source[];
  accounts: Account[];
  assetCategories: { id: number; name: string }[];
}) {
  return (
    <Tabs defaultValue="general" keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="general">Общие</Tabs.Tab>
        <Tabs.Tab value="categories">Категории</Tabs.Tab>
        <Tabs.Tab value="fund">Статьи КС</Tabs.Tab>
        <Tabs.Tab value="income">Источники дохода</Tabs.Tab>
        <Tabs.Tab value="things">Вещи</Tabs.Tab>
        <Tabs.Tab value="accounts">Счета</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="general">
        <GeneralPanel inflationRate={inflationRate} />
      </Tabs.Panel>
      <Tabs.Panel value="categories">
        <CategoriesPanel groups={groups} categories={categories} />
      </Tabs.Panel>
      <Tabs.Panel value="fund">
        <FundPanel fundCategories={fundCategories} />
      </Tabs.Panel>
      <Tabs.Panel value="income">
        <IncomePanel sources={sources} />
      </Tabs.Panel>
      <Tabs.Panel value="things">
        <AssetCategoriesPanel items={assetCategories} />
      </Tabs.Panel>
      <Tabs.Panel value="accounts">
        <AccountsPanel accounts={accounts} />
      </Tabs.Panel>
    </Tabs>
  );
}

function GeneralPanel({ inflationRate }: { inflationRate: number }) {
  const [rate, setRate] = useState<number | string>(inflationRate);
  const [pending, startTransition] = useTransition();
  const save = () =>
    startTransition(async () => {
      notify(await saveSetting('cap_inflation_rate', Number(rate)), 'Коэффициент сохранён');
    });
  return (
    <Stack gap="sm" maw={420}>
      <NumberInput
        label="Коэффициент инфляции КАП (i)"
        description="Цель КАП = цена × i^(срок/12). Смена коэффициента действует только на будущие цели — существующие не пересчитываются."
        value={rate}
        onChange={setRate}
        min={1}
        max={2}
        step={0.01}
        decimalScale={2}
      />
      <Group>
        <Button onClick={save} loading={pending}>
          Сохранить
        </Button>
      </Group>
    </Stack>
  );
}

function CategoriesPanel({ groups, categories }: { groups: Grp[]; categories: Cat[] }) {
  const [groupId, setGroupId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<Cat | null>(null);
  const [deleting, setDeleting] = useState<{ cat: Cat; usage: CategoryUsage[] } | null>(null);

  const add = () =>
    startTransition(async () => {
      notify(await createCategory(Number(groupId), name), 'Категория добавлена — с нулями во всех периодах');
      setName('');
    });

  const toggleArchive = (c: Cat) =>
    startTransition(async () => {
      notify(
        c.activeTo ? await unarchiveCategory(c.id) : await archiveCategory(c.id),
        c.activeTo ? 'Категория возвращена' : 'Категория архивирована',
      );
    });

  const askDelete = (c: Cat) =>
    startTransition(async () => {
      if (c.pendingDelete) {
        notify(await setCategoryPendingDelete(c.id, false), 'Пометка к удалению снята');
        return;
      }
      const usage = await getCategoryUsage(c.id);
      if (usage.length === 0) {
        confirmDanger({
          title: 'Удалить категорию',
          message: `Категория «${c.name}» пуста. Удалить навсегда?`,
          onConfirm: async () => notify(await deleteCategoryHard(c.id), 'Категория удалена'),
        });
      } else {
        setDeleting({ cat: c, usage });
      }
    });

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <Select
          label="Группа"
          data={groups.map((g) => ({ value: String(g.id), label: g.name }))}
          value={groupId}
          onChange={setGroupId}
          w={200}
        />
        <TextInput
          label="Новая подкатегория"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          w={240}
        />
        <Button onClick={add} loading={pending} disabled={!groupId || !name.trim()}>
          Добавить
        </Button>
      </Group>
      {groups.map((g) => {
        const cats = categories.filter((c) => c.groupId === g.id);
        if (cats.length === 0) return null;
        return (
          <Stack key={g.id} gap={4}>
            <Text fw={600} fz="sm">
              {g.name}
            </Text>
            <Group gap={6}>
              {cats.map((c) => (
                <Group
                  key={c.id}
                  gap={4}
                  px={10}
                  py={4}
                  style={{
                    border: `1px solid ${c.pendingDelete ? 'var(--mantine-color-red-4)' : 'var(--ink-line)'}`,
                    borderRadius: 99,
                    opacity: outsideCurrentYear(c.activeFrom, c.activeTo) ? 0.5 : 1,
                  }}
                >
                  <Text fz="xs" td={c.pendingDelete ? 'line-through' : undefined} c={c.pendingDelete ? 'red.7' : undefined}>
                    {c.name}
                  </Text>
                  {periodLabel(c.activeFrom, c.activeTo) && (
                    <Text fz={10} c="dimmed" className="money">
                      {periodLabel(c.activeFrom, c.activeTo)}
                    </Text>
                  )}
                  <Tooltip label="Изменить: название и период действия">
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => setRenaming(c)}>
                      <IconPencil size={12} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={c.activeTo ? 'Вернуть из архива' : 'Архивировать'}>
                    <ActionIcon size="xs" variant="subtle" color="gray" onClick={() => toggleArchive(c)}>
                      {c.activeTo ? <IconArchiveOff size={12} /> : <IconArchive size={12} />}
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label={c.pendingDelete ? 'Снять пометку к удалению' : 'Удалить'}>
                    <ActionIcon size="xs" variant="subtle" color="red" onClick={() => askDelete(c)}>
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ))}
            </Group>
          </Stack>
        );
      })}
      <RenameModal cat={renaming} onClose={() => setRenaming(null)} />
      <DeleteModal state={deleting} onClose={() => setDeleting(null)} />
    </Stack>
  );
}

function RenameModal({ cat, onClose }: { cat: Cat | null; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prev, setPrev] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  if (cat && prev !== cat.id) {
    setValue(cat.name);
    setFrom(cat.activeFrom);
    setTo(cat.activeTo ?? '');
    setPrev(cat.id);
  }
  if (!cat && prev !== null) setPrev(null);
  const save = () =>
    startTransition(async () => {
      if (!cat) return;
      const res = await updateCategory({ id: cat.id, name: value, activeFrom: from, activeTo: to });
      notify(res, 'Категория обновлена');
      if (res.ok) onClose();
    });
  return (
    <FormDrawer opened={!!cat} onClose={onClose} title="Изменить категорию" desktopSize="sm">
      <Stack gap="sm">
        <TextInput label="Название" value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        <Group grow>
          <TextInput
            label="Действует с"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
            placeholder="2025-01-01"
            className="money"
          />
          <TextInput
            label="Действует по"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
            placeholder="пусто — бессрочно"
            className="money"
          />
        </Group>
        <Text fz="xs" c="dimmed">
          «Действует с» решает, в каких днях и месяцах категория видна: чтобы вносить траты задним
          числом, поставьте дату раньше. Название меняется во всех периодах сразу.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending} disabled={!value.trim() || !from.trim()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

function DeleteModal({
  state,
  onClose,
}: {
  state: { cat: Cat; usage: CategoryUsage[] } | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const mark = () =>
    startTransition(async () => {
      if (!state) return;
      notify(await setCategoryPendingDelete(state.cat.id, true), 'Помечена к удалению — предупреждение будет висеть до переноса данных');
      onClose();
    });
  return (
    <FormDrawer opened={!!state} onClose={onClose} title={`Удаление «${state?.cat.name}»`}>
      <Stack gap="sm">
        <Text fz="sm">По категории есть данные — сразу удалить нельзя. Затронуты:</Text>
        <Stack gap={2}>
          {state?.usage.map((u) => (
            <Text key={u.ym} fz="sm" c="dimmed">
              {u.ym}: {u.count} запис. на {u.total.toLocaleString('ru-RU')} ₽
            </Text>
          ))}
        </Stack>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button color="red" onClick={mark} loading={pending}>
            Пометить к удалению
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

function FundPanel({ fundCategories }: { fundCategories: FundCat[] }) {
  const [groupName, setGroupName] = useState('Прочее');
  const [name, setName] = useState('');
  const [plan, setPlan] = useState<number | string>(1000);
  const [editing, setEditing] = useState<FundCat | null>(null);
  const [pending, startTransition] = useTransition();

  const groups = [...new Set(fundCategories.map((c) => c.groupName))];

  const add = () =>
    startTransition(async () => {
      notify(await createFundCategory(groupName, name, Number(plan) || 0), 'Статья добавлена');
      setName('');
    });

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <Select
          label="Группа"
          data={groups}
          value={groupName}
          onChange={(v) => v && setGroupName(v)}
          w={160}
        />
        <TextInput label="Новая статья" value={name} onChange={(e) => setName(e.currentTarget.value)} w={220} />
        <NumberInput label="План ₽/мес" value={plan} onChange={setPlan} w={140} hideControls />
        <Button onClick={add} loading={pending} disabled={!name.trim()}>
          Добавить
        </Button>
      </Group>
      <Table maw={640} verticalSpacing={4} fz="sm">
        <Table.Tbody>
          {fundCategories.map((c) => (
            <FundRow key={c.id} c={c} onEdit={() => setEditing(c)} />
          ))}
        </Table.Tbody>
      </Table>
      <FundEditModal cat={editing} onClose={() => setEditing(null)} />
    </Stack>
  );
}

function FundRow({ c, onEdit }: { c: FundCat; onEdit: () => void }) {
  const [plan, setPlan] = useState<number | string>(c.monthlyPlan);
  const [pending, startTransition] = useTransition();
  const changed = Number(plan) !== c.monthlyPlan;
  const save = () =>
    startTransition(async () => {
      notify(await updateFundPlan(c.id, Number(plan) || 0), 'План обновлён');
    });
  const remove = () =>
    confirmDanger({
      title: `Удалить статью «${c.name}»?`,
      message: 'Удаление возможно только для статей без движений и операций.',
      onConfirm: () =>
        startTransition(async () => {
          notify(await deleteFundCategory(c.id), 'Статья удалена');
        }),
    });
  const outside = outsideCurrentYear(c.activeFrom, c.activeTo);
  const period = periodLabel(c.activeFrom, c.activeTo);
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm" c={outside ? 'dimmed' : undefined}>
          {c.name}
        </Text>
        <Text fz="xs" c="dimmed">
          {c.groupName}
          {period ? ` · ${period}` : ''}
        </Text>
      </Table.Td>
      <Table.Td w={220} ta="right">
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <NumberInput size="xs" value={plan} onChange={setPlan} hideControls w={100} styles={{ input: { textAlign: 'right' } }} />
          {changed && (
            <ActionIcon size="sm" variant="light" onClick={save} loading={pending}>
              <IconCheck size={14} />
            </ActionIcon>
          )}
          <Tooltip label="Название и срок действия">
            <ActionIcon size="sm" variant="subtle" onClick={onEdit}>
              <IconPencil size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить">
            <ActionIcon size="sm" variant="subtle" color="red" onClick={remove} loading={pending}>
              <IconTrash size={14} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

function FundEditModal({ cat, onClose }: { cat: FundCat | null; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [prev, setPrev] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  if (cat && prev !== cat.id) {
    setValue(cat.name);
    setFrom(cat.activeFrom);
    setTo(cat.activeTo ?? '');
    setPrev(cat.id);
  }
  if (!cat && prev !== null) setPrev(null);
  const save = () =>
    startTransition(async () => {
      if (!cat) return;
      const res = await updateFundCategory({ id: cat.id, name: value, activeFrom: from, activeTo: to });
      notify(res, 'Статья обновлена');
      if (res.ok) onClose();
    });
  return (
    <FormDrawer opened={!!cat} onClose={onClose} title="Изменить статью КС" desktopSize="sm">
      <Stack gap="sm">
        <TextInput label="Название" value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        <Group grow>
          <TextInput
            label="Действует с"
            value={from}
            onChange={(e) => setFrom(e.currentTarget.value)}
            placeholder="2025-01-01"
            className="money"
          />
          <TextInput
            label="Действует по"
            value={to}
            onChange={(e) => setTo(e.currentTarget.value)}
            placeholder="пусто — бессрочно"
            className="money"
          />
        </Group>
        <Text fz="xs" c="dimmed">
          В листе КС месяцы вне срока действия блокируются, а в годах целиком вне
          срока статья не показывается. Название меняется во всех периодах сразу.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending} disabled={!value.trim() || !from.trim()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

const SOURCE_TYPES = [
  { value: 'rent', label: 'Аренда' },
  { value: 'monthly_payment', label: 'Ежемесячный платёж' },
  { value: 'one_off', label: 'Разовый' },
  { value: 'interest_cashback', label: 'Проценты и кэшбек' },
  { value: 'cash_income', label: 'Наличные' },
  { value: 'compensation', label: 'Компенсации' },
];

function IncomePanel({ sources }: { sources: Source[] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>('one_off');
  const [renaming, setRenaming] = useState<Source | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      notify(await createIncomeSource(name, type ?? 'one_off'), 'Источник добавлен');
      setName('');
    });

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <TextInput label="Новый источник" value={name} onChange={(e) => setName(e.currentTarget.value)} w={240} />
        <Select label="Тип" data={SOURCE_TYPES} value={type} onChange={setType} w={200} />
        <Button onClick={add} loading={pending} disabled={!name.trim()}>
          Добавить
        </Button>
      </Group>
      <RenameSourceDrawer source={renaming} onClose={() => setRenaming(null)} />
      <Table maw={620} verticalSpacing={4} fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Источник</Table.Th>
            <Table.Th ta="right">Ожидаемо ₽/мес (для прогноза)</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sources.map((s) => (
            <SourceRow key={s.id} s={s} onRename={() => setRenaming(s)} />
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function SourceRow({ s, onRename }: { s: Source; onRename: () => void }) {
  const [expected, setExpected] = useState<number | string>(s.expectedMonthly ?? '');
  const [pending, startTransition] = useTransition();
  const changed = (Number(expected) || 0) !== (s.expectedMonthly ?? 0);
  const save = () =>
    startTransition(async () => {
      notify(
        await updateIncomeExpected(s.id, expected === '' ? null : Number(expected)),
        'Сохранено',
      );
    });

  const remove = () =>
    confirmDanger({
      title: 'Удалить источник',
      message: `Источник «${s.name}» будет удалён. Удаление возможно, только если по нему нет поступлений.`,
      onConfirm: () =>
        startTransition(async () => {
          notify(await deleteIncomeSource(s.id), 'Источник удалён');
        }),
    });
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm">{s.name}</Text>
        <Text fz="xs" c="dimmed">
          {SOURCE_TYPES.find((t) => t.value === s.type)?.label ?? s.type}
        </Text>
      </Table.Td>
      <Table.Td w={180} ta="right">
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <NumberInput
            size="xs"
            value={expected}
            onChange={setExpected}
            hideControls
            w={110}
            placeholder="—"
            styles={{ input: { textAlign: 'right' } }}
          />
          {changed && (
            <ActionIcon size="sm" variant="light" onClick={save} loading={pending}>
              <IconCheck size={14} />
            </ActionIcon>
          )}
          <Tooltip label="Переименовать">
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={onRename}>
              <IconPencil size={14} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить">
            <ActionIcon variant="subtle" color="red" size="sm" onClick={remove}>
              <IconTrash size={14} stroke={1.6} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

function RenameSourceDrawer({ source, onClose }: { source: Source | null; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();

  if (source && !opened) {
    setValue(source.name);
    setOpened(true);
  }
  if (!source && opened) setOpened(false);

  const save = () =>
    startTransition(async () => {
      if (!source) return;
      const res = await renameIncomeSource(source.id, value);
      notify(res, 'Источник переименован');
      if (res.ok) onClose();
    });

  return (
    <FormDrawer opened={!!source} onClose={onClose} title="Переименовать источник" desktopSize="sm">
      <Stack gap="sm">
        <TextInput label="Название" value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending} disabled={!value.trim()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Дебетовый' },
  { value: 'credit_card', label: 'Кредитка' },
  { value: 'deposit', label: 'Вклад' },
  { value: 'cash', label: 'Наличные' },
  { value: 'metals', label: 'Металлы' },
  { value: 'brokerage', label: 'Брокерский' },
];

function AccountsPanel({ accounts }: { accounts: Account[] }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string | null>('checking');
  const [renaming, setRenaming] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();

  const add = () =>
    startTransition(async () => {
      notify(await createAccount(name, type ?? 'checking'), 'Счёт добавлен');
      setName('');
    });

  const toggle = (a: Account) =>
    startTransition(async () => {
      notify(await toggleAccountActive(a.id, !a.isActive), a.isActive ? 'Счёт скрыт' : 'Счёт активен');
    });

  const remove = (a: Account) =>
    confirmDanger({
      title: 'Удалить счёт',
      message: `Счёт «${a.name}» будет удалён. Удаление возможно, только если по счёту нет операций и снапшотов.`,
      onConfirm: () =>
        startTransition(async () => {
          notify(await deleteAccount(a.id), 'Счёт удалён');
        }),
    });

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <TextInput label="Новый счёт" value={name} onChange={(e) => setName(e.currentTarget.value)} w={240} />
        <Select label="Тип" data={ACCOUNT_TYPES} value={type} onChange={setType} w={180} />
        <Button onClick={add} loading={pending} disabled={!name.trim()}>
          Добавить
        </Button>
      </Group>
      <Stack gap={4} maw={520}>
        {accounts.map((a) => (
          <Group key={a.id} justify="space-between" py={4} wrap="nowrap" style={{ borderBottom: '1px solid var(--ink-line)', opacity: a.isActive ? 1 : 0.5 }}>
            <Text fz="sm" truncate>
              {a.name}{' '}
              <Text span fz="xs" c="dimmed">
                {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
              </Text>
            </Text>
            <Group gap={2} wrap="nowrap">
              <Tooltip label="Учитывать в итоговой сумме на «Балансе»">
                <Switch
                  size="xs"
                  checked={a.includeInTotal}
                  onChange={(e) => {
                    const value = e.currentTarget.checked;
                    startTransition(async () => {
                      notify(await setAccountInTotal(a.id, value), 'Итог баланса обновлён');
                    });
                  }}
                  label="в итоге"
                  labelPosition="left"
                  styles={{ label: { fontSize: 11, color: 'var(--mantine-color-gray-6)' } }}
                />
              </Tooltip>
              <Tooltip label="Переименовать">
                <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setRenaming(a)}>
                  <IconPencil size={14} stroke={1.6} />
                </ActionIcon>
              </Tooltip>
              <Button size="compact-xs" variant="subtle" color="gray" onClick={() => toggle(a)}>
                {a.isActive ? 'Скрыть' : 'Вернуть'}
              </Button>
              <Tooltip label="Удалить">
                <ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(a)}>
                  <IconTrash size={14} stroke={1.6} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        ))}
      </Stack>
      <RenameAccountDrawer account={renaming} onClose={() => setRenaming(null)} />
    </Stack>
  );
}

function RenameAccountDrawer({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();

  if (account && !opened) {
    setValue(account.name);
    setOpened(true);
  }
  if (!account && opened) setOpened(false);

  const save = () =>
    startTransition(async () => {
      if (!account) return;
      const res = await renameAccount(account.id, value);
      notify(res, 'Счёт переименован');
      if (res.ok) onClose();
    });

  return (
    <FormDrawer opened={!!account} onClose={onClose} title="Переименовать счёт" desktopSize="sm">
      <Stack gap="sm">
        <TextInput label="Название" value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending} disabled={!value.trim()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}

// ------------------------------------------------------- категории вещей

function AssetCategoriesPanel({ items }: { items: { id: number; name: string }[] }) {
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const move = (id: number, dir: -1 | 1) =>
    startTransition(async () => {
      notify(await moveAssetCategory(id, dir), 'Порядок обновлён');
    });

  return (
    <Card maw={560}>
      <Stack gap="sm">
        <Text fz="sm" c="dimmed">
          Категории покупок на страницах «Амортизация» и «КАП»: название и порядок групп.
        </Text>
        <Table verticalSpacing={6} fz="sm">
          <Table.Tbody>
            {items.map((c, i) => (
              <Table.Tr key={c.id}>
                <Table.Td px={0}>{c.name}</Table.Td>
                <Table.Td px={0} w={110}>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Tooltip label="Выше">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        disabled={i === 0 || pending}
                        onClick={() => move(c.id, -1)}
                      >
                        <IconChevronUp size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Ниже">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        size="sm"
                        disabled={i === items.length - 1 || pending}
                        onClick={() => move(c.id, 1)}
                      >
                        <IconChevronDown size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Переименовать">
                      <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => setRenaming(c)}>
                        <IconPencil size={14} stroke={1.6} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Stack>
      <RenameAssetCategoryDrawer target={renaming} onClose={() => setRenaming(null)} />
    </Card>
  );
}

function RenameAssetCategoryDrawer({
  target,
  onClose,
}: {
  target: { id: number; name: string } | null;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [opened, setOpened] = useState(false);
  const [pending, startTransition] = useTransition();

  if (target && !opened) {
    setValue(target.name);
    setOpened(true);
  }
  if (!target && opened) setOpened(false);

  const save = () =>
    startTransition(async () => {
      if (!target) return;
      const res = await renameAssetCategory(target.id, value);
      notify(res, 'Категория переименована');
      if (res.ok) onClose();
    });

  return (
    <FormDrawer opened={!!target} onClose={onClose} title="Переименовать категорию" desktopSize="sm">
      <Stack gap="sm">
        <TextInput label="Название" value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        <Text fz="xs" c="dimmed">
          Категория «Покупки → {target?.name}» в таблицах месяца и года переименуется вместе с ней.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending} disabled={!value.trim()}>
            Сохранить
          </Button>
        </Group>
      </Stack>
    </FormDrawer>
  );
}
