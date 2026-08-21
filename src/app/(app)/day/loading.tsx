import { Card, Group, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={6}>
          <Skeleton height={26} width={180} />
          <Skeleton height={14} width={240} />
        </Stack>
        <Skeleton height={34} width={280} />
      </Group>
      <Group align="flex-start" gap="md" wrap="nowrap">
        <Card w={196} p="xs" visibleFrom="sm">
          <Stack gap={8}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} height={30} />
            ))}
          </Stack>
        </Card>
        <Card style={{ flex: 1 }}>
          <Stack gap="sm">
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={30} width={200} />
            <Skeleton height={100} />
          </Stack>
        </Card>
      </Group>
    </Stack>
  );
}
