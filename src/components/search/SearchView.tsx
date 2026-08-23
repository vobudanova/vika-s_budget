'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Center, Loader, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import type { TxRow } from '@/queries/core';
import { TxList } from '@/components/TxList';
import { searchTransactions, type IncomeCursor } from '@/actions/transactions';

/** Поиск по всем операциям: заметки, категории, счета, источники, суммы. */
export function SearchView() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<TxRow[]>([]);
  const [cursor, setCursor] = useState<IncomeCursor | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const seqRef = useRef(0);
  const busyRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // debounce 350ms; устаревшие ответы отбрасываются по номеру запроса
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setCursor(null);
      setSearched(false);
      setSearching(false);
      return;
    }
    const seq = ++seqRef.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchTransactions(q, null);
        if (seqRef.current !== seq) return;
        setItems(res.items);
        setCursor(res.nextCursor);
        setSearched(true);
      } finally {
        if (seqRef.current === seq) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadMore = useCallback(async () => {
    if (busyRef.current || !cursor) return;
    busyRef.current = true;
    setLoadingMore(true);
    const seq = seqRef.current;
    try {
      const res = await searchTransactions(query.trim(), cursor);
      if (seqRef.current !== seq) return;
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } finally {
      busyRef.current = false;
      setLoadingMore(false);
    }
  }, [cursor, query]);

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
      <TextInput
        size="md"
        placeholder="Заметка, категория, счёт, источник или сумма…"
        leftSection={<IconSearch size={18} stroke={1.8} />}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        rightSection={searching ? <Loader size="xs" color="ink" /> : null}
        autoFocus
      />
      {searched && (
        <Card>
          <Stack gap="sm">
            <TxList
              items={items}
              showDate
              showYear
              emptyText="Ничего не нашлось. Попробуйте иначе сформулировать."
            />
            <div ref={sentinelRef} />
            {cursor && (
              <Center py={4}>
                <Button variant="subtle" size="compact-sm" onClick={() => void loadMore()} loading={loadingMore}>
                  Показать ещё
                </Button>
              </Center>
            )}
            {!cursor && items.length > 0 && (
              <Text fz="xs" c="dimmed" ta="center" className="money">
                Найдено {items.length}
              </Text>
            )}
          </Stack>
        </Card>
      )}
      {!searched && (
        <Text fz="sm" c="dimmed">
          Ищет по всем операциям за всю историю: заметкам, категориям, счетам, источникам дохода,
          статьям КС и суммам. Несколько слов — все должны совпасть.
        </Text>
      )}
    </Stack>
  );
}
