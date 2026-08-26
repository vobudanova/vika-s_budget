'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Center, Group, Select, Stack, Text } from '@mantine/core';
import type { TxRow } from '@/queries/core';
import { TxList } from '@/components/TxList';
import {
  listAccountMovesPage,
  type AccountMovesFilter,
  type IncomeCursor,
} from '@/actions/transactions';
import { fmtNumber } from '@/lib/money';

export type AccountChip = { id: number; name: string; balance: number };

const FILTERS: { value: AccountMovesFilter; label: string }[] = [
  { value: 'all', label: 'Все движения' },
  { value: 'compensation', label: 'Компенсации' },
  { value: 'transfer', label: 'Переводы' },
  { value: 'income', label: 'Доходы' },
  { value: 'expense', label: 'Расходы и покупки' },
  { value: 'saving', label: 'Сбережения' },
];

/** «Движение по счетам»: выбор счёта, фильтр по виду операции и полная
    лента движений (включая скрытые из таблиц) с дозагрузкой по 50. */
export function AccountMovesView({
  accounts,
  initial,
  initialCursor,
}: {
  accounts: AccountChip[];
  initial: TxRow[];
  initialCursor: IncomeCursor | null;
}) {
  const [accId, setAccId] = useState(accounts[0]?.id ?? null);
  const [filter, setFilter] = useState<AccountMovesFilter>('all');
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);
  const firstRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // смена счёта или фильтра перезагружает ленту с первой страницы
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    if (accId == null) return;
    let stale = false;
    busyRef.current = true;
    setLoading(true);
    setItems([]);
    setCursor(null);
    listAccountMovesPage(accId, filter, null)
      .then((res) => {
        if (stale) return;
        setItems(res.items);
        setCursor(res.nextCursor);
      })
      .finally(() => {
        if (!stale) {
          busyRef.current = false;
          setLoading(false);
        }
      });
    return () => {
      stale = true;
    };
  }, [accId, filter]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !cursor || accId == null) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const res = await listAccountMovesPage(accId, filter, cursor);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [accId, filter, cursor]);

  useEffect(() => {
    if (!cursor) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) void loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, loadMore]);

  return (
    <Stack gap="md">
      <Group gap={6} wrap="wrap">
        {accounts.map((a) => (
          <Button
            key={a.id}
            size="compact-sm"
            radius="xl"
            variant={a.id === accId ? 'filled' : 'default'}
            onClick={() => setAccId(a.id)}
          >
            {a.name}
            <Text span fz="xs" ml={6} className="money" opacity={0.75}>
              {fmtNumber(a.balance, 0)}
            </Text>
          </Button>
        ))}
      </Group>
      <Group justify="space-between" align="flex-end">
        <Select
          label="Показывать"
          data={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={filter}
          onChange={(v) => v && setFilter(v as AccountMovesFilter)}
          w={220}
          allowDeselect={false}
        />
      </Group>
      <Card>
        <TxList
          items={items}
          showDate
          showYear
          emptyText={loading ? 'Загрузка…' : 'Движений не найдено'}
        />
        <div ref={sentinelRef} />
        {cursor && (
          <Center py={4}>
            <Button variant="subtle" size="compact-sm" onClick={() => void loadMore()} loading={loading}>
              Показать ещё
            </Button>
          </Center>
        )}
      </Card>
    </Stack>
  );
}
