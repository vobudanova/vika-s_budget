'use client';

import { useState, useTransition } from 'react';
import {
  ActionIcon,
  Button,
  Group,
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
import { IconArchive, IconArchiveOff, IconCheck, IconPencil, IconTrash } from '@tabler/icons-react';
import {
  archiveCategory,
  createAccount,
  createCategory,
  createFundCategory,
  createIncomeSource,
  deleteCategoryHard,
  getCategoryUsage,
  renameCategory,
  setCategoryPendingDelete,
  toggleAccountActive,
  unarchiveCategory,
  updateFundPlan,
  updateIncomeExpected,
  type CategoryUsage,
} from '@/actions/reference';
import { saveSetting } from '@/actions/misc';

type Cat = {
  id: number;
  groupId: number;
  name: string;
  activeTo: string | null;
  pendingDelete: boolean;
};
type Grp = { id: number; name: string };
type FundCat = { id: number; name: string; groupName: string; monthlyPlan: number };
type Source = { id: number; name: string; type: string; expectedMonthly: number | null };
type Account = { id: number; name: string; type: string; isActive: boolean };

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
}: {
  inflationRate: number;
  groups: Grp[];
  categories: Cat[];
  fundCategories: FundCat[];
  sources: Source[];
  accounts: Account[];
}) {
  return (
    <Tabs defaultValue="general" keepMounted={false}>
      <Tabs.List mb="md">
        <Tabs.Tab value="general">Общие</Tabs.Tab>
        <Tabs.Tab value="categories">Категории</Tabs.Tab>
        <Tabs.Tab value="fund">Статьи КС</Tabs.Tab>
        <Tabs.Tab value="income">Источники дохода</Tabs.Tab>
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
        if (confirm(`Категория «${c.name}» пуста. Удалить навсегда?`)) {
          notify(await deleteCategoryHard(c.id), 'Категория удалена');
        }
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
                    opacity: c.activeTo ? 0.5 : 1,
                  }}
                >
                  <Text fz="xs" td={c.pendingDelete ? 'line-through' : undefined} c={c.pendingDelete ? 'red.7' : undefined}>
                    {c.name}
                  </Text>
                  <Tooltip label="Переименовать (изменится во всех прошлых и будущих периодах)">
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
      <Text fz="xs" c="dimmed">
        Переименование меняет название везде. Удаление категории с данными сначала помечает её — на
        страницах месяца и года будет висеть предупреждение, пока записи не перенесены; когда всё
        обнулится, на странице года появится красная корзинка окончательного удаления.
      </Text>

      <RenameModal cat={renaming} onClose={() => setRenaming(null)} />
      <DeleteModal state={deleting} onClose={() => setDeleting(null)} />
    </Stack>
  );
}

function RenameModal({ cat, onClose }: { cat: Cat | null; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [prev, setPrev] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  if (cat && prev !== cat.id) {
    setValue(cat.name);
    setPrev(cat.id);
  }
  const save = () =>
    startTransition(async () => {
      if (!cat) return;
      notify(await renameCategory(cat.id, value), 'Переименовано во всех периодах');
      onClose();
    });
  return (
    <FormDrawer opened={!!cat} onClose={onClose} title="Переименовать категорию" desktopSize="sm">
      <Stack gap="sm">
        <TextInput label="Название" value={value} onChange={(e) => setValue(e.currentTarget.value)} autoFocus />
        <Text fz="xs" c="dimmed">
          Название изменится во всех прошлых и будущих месяцах, в годовой таблице и во всех формах.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={save} loading={pending} disabled={!value.trim()}>
            Переименовать
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
        <Text fz="xs" c="dimmed">
          Можно пометить категорию к удалению и продолжать работу: на страницах месяца и года будет
          висеть предупреждение, пока записи не перенесены в другие категории. Когда всё обнулится —
          красная корзинка на странице года удалит её навсегда.
        </Text>
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
      <Table maw={560} verticalSpacing={4} fz="sm">
        <Table.Tbody>
          {fundCategories.map((c) => (
            <FundRow key={c.id} c={c} />
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function FundRow({ c }: { c: FundCat }) {
  const [plan, setPlan] = useState<number | string>(c.monthlyPlan);
  const [pending, startTransition] = useTransition();
  const changed = Number(plan) !== c.monthlyPlan;
  const save = () =>
    startTransition(async () => {
      notify(await updateFundPlan(c.id, Number(plan) || 0), 'План обновлён');
    });
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm">{c.name}</Text>
        <Text fz="xs" c="dimmed">
          {c.groupName}
        </Text>
      </Table.Td>
      <Table.Td w={160} ta="right">
        <Group gap={4} justify="flex-end" wrap="nowrap">
          <NumberInput size="xs" value={plan} onChange={setPlan} hideControls w={100} styles={{ input: { textAlign: 'right' } }} />
          {changed && (
            <ActionIcon size="sm" variant="light" onClick={save} loading={pending}>
              <IconCheck size={14} />
            </ActionIcon>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
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
      <Table maw={560} verticalSpacing={4} fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Источник</Table.Th>
            <Table.Th ta="right">Ожидаемо ₽/мес (для прогноза)</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sources.map((s) => (
            <SourceRow key={s.id} s={s} />
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  );
}

function SourceRow({ s }: { s: Source }) {
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
        </Group>
      </Table.Td>
    </Table.Tr>
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

  return (
    <Stack gap="md">
      <Group align="flex-end" gap="xs" wrap="wrap">
        <TextInput label="Новый счёт" value={name} onChange={(e) => setName(e.currentTarget.value)} w={240} />
        <Select label="Тип" data={ACCOUNT_TYPES} value={type} onChange={setType} w={180} />
        <Button onClick={add} loading={pending} disabled={!name.trim()}>
          Добавить
        </Button>
      </Group>
      <Stack gap={4} maw={480}>
        {accounts.map((a) => (
          <Group key={a.id} justify="space-between" py={4} style={{ borderBottom: '1px solid var(--ink-line)', opacity: a.isActive ? 1 : 0.5 }}>
            <Text fz="sm">
              {a.name}{' '}
              <Text span fz="xs" c="dimmed">
                {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
              </Text>
            </Text>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => toggle(a)}>
              {a.isActive ? 'Скрыть' : 'Вернуть'}
            </Button>
          </Group>
        ))}
      </Stack>
      <Text fz="xs" c="dimmed">
        Скрытый счёт не участвует в балансах и формах, но история операций сохраняется.
      </Text>
    </Stack>
  );
}
