'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Center, Text } from '@mantine/core';
import type { TxRow } from '@/queries/core';
import { TxList } from '@/components/TxList';
import { listIncomePage, type IncomeCursor } from '@/actions/transactions';

/** Все поступления с дозагрузкой по скроллу (страницы по 50). */
export function IncomeList({
  initial,
  initialCursor,
}: {
  initial: TxRow[];
  initialCursor: IncomeCursor | null;
}) {
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !cursor) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const res = await listIncomePage(cursor);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  }, [cursor]);

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
    <>
      <TxList items={items} showDate emptyText="Доходов пока нет" />
      <div ref={sentinelRef} />
      {cursor && (
        <Center py={4}>
          <Button variant="subtle" size="compact-sm" onClick={() => void loadMore()} loading={loading}>
            Показать ещё
          </Button>
        </Center>
      )}
      {!cursor && items.length > 0 && (
        <Text fz="xs" c="dimmed" ta="center" py={4} className="money">
          Все операции показаны · {items.length}
        </Text>
      )}
    </>
  );
}
