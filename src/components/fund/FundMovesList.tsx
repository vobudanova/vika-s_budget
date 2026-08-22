'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Center, Group, Stack, Text } from '@mantine/core';
import { Money } from '@/components/Money';
import { listFundMovesPage, type FundMoveCursor, type FundMoveRow } from '@/actions/fund';

const KIND_LABELS: Record<string, string> = {
  plan_topup: 'пополнение по плану',
  extra_topup: 'доп. пополнение',
  reimbursement: 'компенсация',
  adjustment: 'корректировка',
};
const SETTLE_LABELS: Record<string, string> = {
  from_account: 'со счёта КС',
  offset_next_topup: 'зачёт в пополнении',
};

/** Движения фонда КС с дозагрузкой по скроллу (страницы по 50). */
export function FundMovesList({
  initial,
  initialCursor,
}: {
  initial: FundMoveRow[];
  initialCursor: FundMoveCursor | null;
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
      const res = await listFundMovesPage(cursor);
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

  if (items.length === 0)
    return (
      <Text fz="sm" c="dimmed">
        Движений пока нет.
      </Text>
    );

  return (
    <>
      <Stack gap={0}>
        {items.map((m, i) => {
          const sub = [
            KIND_LABELS[m.kind] ?? m.kind,
            m.settle ? SETTLE_LABELS[m.settle] : null,
            m.note,
          ]
            .filter(Boolean)
            .join(' · ');
          return (
            <Group
              key={m.id}
              justify="space-between"
              wrap="nowrap"
              py={7}
              gap="xs"
              style={{ borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--ink-line)' }}
            >
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text fz="sm" fw={500}>
                  {m.date.slice(8, 10)}.{m.date.slice(5, 7)} · {m.categoryName}
                </Text>
                {sub && (
                  <Text fz="xs" c="dimmed" style={{ overflowWrap: 'anywhere' }}>
                    {sub}
                  </Text>
                )}
              </Stack>
              <Money
                value={m.amount}
                signed
                fz="sm"
                fw={500}
                c={m.amount > 0 ? 'teal.8' : undefined}
                style={{ flexShrink: 0 }}
              />
            </Group>
          );
        })}
      </Stack>
      <div ref={sentinelRef} />
      {cursor && (
        <Center py={4}>
          <Button variant="subtle" size="compact-sm" onClick={() => void loadMore()} loading={loading}>
            Показать ещё
          </Button>
        </Center>
      )}
      {!cursor && (
        <Text fz="xs" c="dimmed" ta="center" py={4} className="money">
          Все движения показаны · {items.length}
        </Text>
      )}
    </>
  );
}
