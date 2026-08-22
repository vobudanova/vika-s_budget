import { Card, Group, Skeleton, Stack } from '@mantine/core';
import { HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

/** Скелет доходов: шапка с кнопками, широкая таблица-лист, последние поступления. */
export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={130} subtitleW={160} rightW={260} />
      <Card p="md">
        <Stack gap={9}>
          <Group gap={8} wrap="nowrap">
            <Skeleton height={22} width={190} style={{ flexShrink: 0 }} />
            <Skeleton height={22} width={78} style={{ flexShrink: 0 }} />
            {Array.from({ length: 12 }, (_, i) => (
              <Skeleton key={i} height={22} width={64} style={{ flexShrink: 0 }} />
            ))}
          </Group>
          {Array.from({ length: 6 }, (_, r) => (
            <Group key={r} gap={8} wrap="nowrap">
              <Skeleton
                height={13}
                width={r % 3 === 0 ? 120 : 100}
                ml={r % 3 === 0 ? 0 : 16}
                style={{ flexShrink: 0 }}
              />
              <Skeleton height={13} style={{ flex: 1 }} />
            </Group>
          ))}
        </Stack>
      </Card>
      <TableCardSkeleton rows={4} />
    </Stack>
  );
}
