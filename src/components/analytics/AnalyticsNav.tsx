'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@mantine/core';

/** Переключатель разделов аналитики: Тренды · Месяц · КАП · Годы. */
export function AnalyticsNav({ tab, ym }: { tab: 'trends' | 'month' | 'cap' | 'years'; ym: string }) {
  const router = useRouter();
  const href = (v: string) =>
    v === 'trends'
      ? '/analytics'
      : v === 'cap'
        ? '/analytics/cap'
        : v === 'years'
          ? '/analytics/years'
          : `/analytics/${ym}`;
  return (
    <SegmentedControl
      value={tab}
      onChange={(v) => v !== tab && router.push(href(v))}
      data={[
        { value: 'trends', label: 'Тренды' },
        { value: 'month', label: 'Месяц' },
        { value: 'cap', label: 'КАП' },
        { value: 'years', label: 'Годы' },
      ]}
      size="sm"
    />
  );
}
