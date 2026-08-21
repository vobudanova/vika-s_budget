import { Card, Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';

/** Заголовок страницы: тайтл + подзаголовок, справа — опциональный блок. */
export function HeaderSkeleton({
  titleW = 220,
  subtitleW = 320,
  rightW,
}: {
  titleW?: number;
  subtitleW?: number;
  rightW?: number;
}) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
      <Stack gap={6}>
        <Skeleton height={26} width={titleW} />
        <Skeleton height={14} width={subtitleW} />
      </Stack>
      {rightW ? <Skeleton height={34} width={rightW} /> : null}
    </Group>
  );
}

/** Карточка-таблица: строки с широкой левой колонкой и числами справа. */
export function TableCardSkeleton({ rows = 8, header = true }: { rows?: number; header?: boolean }) {
  return (
    <Card>
      <Stack gap={10}>
        {header && (
          <Group justify="space-between">
            <Skeleton height={12} width={140} />
            <Skeleton height={12} width={90} />
          </Group>
        )}
        {Array.from({ length: rows }, (_, i) => (
          <Group key={i} justify="space-between" wrap="nowrap" gap="md">
            <Skeleton height={13} width={`${34 + ((i * 13) % 28)}%`} />
            <Skeleton height={13} width={72} />
          </Group>
        ))}
      </Stack>
    </Card>
  );
}

/** Матрица месяца: переключатели + широкая таблица с колонками дней. */
export function MatrixSkeleton() {
  return (
    <Stack gap="md">
      <Group gap="sm">
        <Skeleton height={28} width={150} />
        <Skeleton height={28} width={210} />
        <Skeleton height={16} width={170} />
      </Group>
      <Card p="md">
        <Stack gap={9}>
          <Group gap={8} wrap="nowrap">
            <Skeleton height={12} width={150} style={{ flexShrink: 0 }} />
            {Array.from({ length: 14 }, (_, i) => (
              <Skeleton key={i} height={12} width={34} style={{ flexShrink: 0 }} />
            ))}
          </Group>
          {Array.from({ length: 12 }, (_, r) => (
            <Group key={r} gap={8} wrap="nowrap">
              <Skeleton height={13} width={r % 4 === 0 ? 120 : 100} ml={r % 4 === 0 ? 0 : 16} style={{ flexShrink: 0 }} />
              <Skeleton height={13} style={{ flex: 1 }} />
            </Group>
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

/** Карточка цели КАП: название + бейдж, прогресс, флажки месяцев. */
export function GoalCardSkeleton() {
  return (
    <Card>
      <Stack gap="xs">
        <Group justify="space-between">
          <Skeleton height={14} width="55%" />
          <Skeleton height={18} width={84} radius="xl" />
        </Group>
        <Skeleton height={8} radius="xl" />
        <Group justify="space-between">
          <Skeleton height={11} width={150} />
          <Skeleton height={11} width={110} />
        </Group>
        <Group gap={4}>
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} height={24} width={26} radius={6} />
          ))}
        </Group>
      </Stack>
    </Card>
  );
}

/** Сетка карточек-форм (доходы, прогноз и т.п.). */
export function FormCardSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Card>
      <Stack gap="sm">
        <Skeleton height={12} width={130} />
        {Array.from({ length: fields }, (_, i) => (
          <Group key={i} grow gap="sm">
            <Skeleton height={36} />
            <Skeleton height={36} />
          </Group>
        ))}
        <Skeleton height={34} width={160} />
      </Stack>
    </Card>
  );
}

export { Card, Group, SimpleGrid, Skeleton, Stack };
