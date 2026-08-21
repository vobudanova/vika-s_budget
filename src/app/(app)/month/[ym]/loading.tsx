import { Card, Group, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={6}>
          <Skeleton height={26} width={200} />
          <Skeleton height={14} width={300} />
        </Stack>
        <Skeleton height={34} width={280} />
      </Group>
      <Group gap="sm">
        <Skeleton height={28} width={160} />
        <Skeleton height={28} width={220} />
      </Group>
      <Card>
        <Stack gap={8}>
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} height={18} />
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}
