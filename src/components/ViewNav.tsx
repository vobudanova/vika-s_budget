'use client';

import { useRouter } from 'next/navigation';
import { SegmentedControl } from '@mantine/core';

/** Переключатель видов страницы — каждый таб живёт на своём URL. */
export function ViewNav({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <SegmentedControl
      value={value}
      onChange={(v) => {
        const target = options.find((o) => o.value === v);
        if (target && v !== value) router.push(target.href);
      }}
      data={options.map(({ value: v, label }) => ({ value: v, label }))}
      size="sm"
      w="fit-content"
    />
  );
}
