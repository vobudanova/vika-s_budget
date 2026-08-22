'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  Button,
  Checkbox,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createPurchase } from '@/actions/assets';
import { parseAmountExpr, fmtMoney, round2 } from '@/lib/money';

export function PurchaseForm({
  date,
  assetCategories,
  accounts,
  defaultAccountId,
  inflationRate,
}: {
  date: string;
  assetCategories: { id: number; name: string }[];
  accounts: { id: number; name: string }[];
  defaultAccountId: number | null;
  inflationRate: number;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [term, setTerm] = useState<number | string>(24);
  const [assetCategoryId, setAssetCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(
    defaultAccountId ? String(defaultAccountId) : null,
  );
  const [withCap, setWithCap] = useState(true);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const p = parseAmountExpr(price);
    const t = Number(term);
    if (!p || !t || t < 1) return null;
    const monthlyAmort = round2(p / t);
    const target = round2(p * Math.pow(inflationRate, t / 12));
    const monthlyCap = round2(target / t);
    return { monthlyAmort, target, monthlyCap };
  }, [price, term, inflationRate]);

  const submit = () =>
    startTransition(async () => {
      if (!assetCategoryId) {
        notifications.show({ color: 'red', message: 'Выберите категорию актива' });
        return;
      }
      const res = await createPurchase({
        name,
        date,
        price,
        assetCategoryId: Number(assetCategoryId),
        termMonths: Number(term),
        accountId: accountId ? Number(accountId) : null,
        withCap,
      });
      if (!res.ok) {
        notifications.show({ color: 'red', message: res.error });
      } else {
        notifications.show({ message: `Покупка «${name}» сохранена: график и КАП созданы` });
        setName('');
        setPrice('');
      }
    });

  return (
    <Stack gap="sm">
      <TextInput
        label="Наименование"
        placeholder="Кроссовки New Balance"
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <Group grow>
        <TextInput
          label="Цена"
          placeholder="18 990"
          value={price}
          onChange={(e) => setPrice(e.currentTarget.value)}
          className="money"
          inputMode="decimal"
        />
        <NumberInput
          label="Срок службы, мес"
          value={term}
          onChange={setTerm}
          min={1}
          max={120}
          clampBehavior="strict"
        />
      </Group>
      <Group grow>
        <Select
          label="Категория актива"
          placeholder="Одежда"
          data={assetCategories.map((c) => ({ value: String(c.id), label: c.name }))}
          value={assetCategoryId}
          onChange={setAssetCategoryId}
        />
        <Select
          label="Счёт списания"
          data={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
          value={accountId}
          onChange={setAccountId}
        />
      </Group>
      <Checkbox
        label="Копить на замену (КАП)"
        checked={withCap}
        onChange={(e) => setWithCap(e.currentTarget.checked)}
      />
      {preview && (
        <Paper p="sm" bg="var(--mantine-color-ink-0)" withBorder={false}>
          <Table verticalSpacing={4} fz="sm">
            <Table.Tbody>
              <Table.Tr>
                <Table.Td px={0}>Амортизация</Table.Td>
                <Table.Td px={0} ta="right" className="money">
                  {fmtMoney(preview.monthlyAmort)}/мес
                </Table.Td>
              </Table.Tr>
              {withCap && (
                <>
                  <Table.Tr>
                    <Table.Td px={0}>
                      Цель КАП <Text span c="dimmed" fz="xs">× {inflationRate}</Text>
                    </Table.Td>
                    <Table.Td px={0} ta="right" className="money">
                      {fmtMoney(preview.target)}
                    </Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td px={0}>Взнос КАП</Table.Td>
                    <Table.Td px={0} ta="right" className="money">
                      {fmtMoney(preview.monthlyCap)}/мес
                    </Table.Td>
                  </Table.Tr>
                </>
              )}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
      <Group>
        <Button onClick={submit} loading={pending} disabled={!name || !price}>
          Сохранить покупку
        </Button>
      </Group>
    </Stack>
  );
}
