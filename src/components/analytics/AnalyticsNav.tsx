'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@mantine/core';

/** Переключатель разделов аналитики: Тренды (/analytics) и Месяц (/analytics/[ym]). */
export function AnalyticsNav({ tab, ym }: { tab: 'trends' | 'month'; ym: string }) {
  const router = useRouter();
  return (
    <SegmentedControl
      value={tab}
      onChange={(v) => router.push(v === 'trends' ? '/analytics' : `/analytics/${ym}`)}
      data={[
        { value: 'trends', label: 'Тренды' },
        { value: 'month', label: 'Месяц' },
      ]}
      size="sm"
    />
  );
}
