import { Card, Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';

/** Скелет аналитики: шапка с переключателем, статы, находки, графики. */
export default function Loading() {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="md" align="center" wrap="wrap">
          <Skeleton height={30} width={180} />
          <Skeleton height={32} width={150} radius="sm" />
        </Group>
        <Skeleton height={42} width={290} />
      </Group>
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <Stack gap={8}>
              <Skeleton height={10} width={90} />
              <Skeleton height={24} width={120} />
              <Skeleton height={10} width={80} />
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i}>
            <Group gap="sm" wrap="nowrap" align="flex-start">
              <Skeleton height={32} width={32} radius="md" />
              <Stack gap={6} style={{ flex: 1 }}>
                <Skeleton height={13} width="60%" />
                <Skeleton height={10} />
                <Skeleton height={10} width="80%" />
              </Stack>
            </Group>
          </Card>
        ))}
      </SimpleGrid>
      <Card>
        <Stack gap="sm">
          <Skeleton height={10} width={130} />
          <Skeleton height={200} />
        </Stack>
      </Card>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <Skeleton height={10} width={140} />
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} height={16} />
            ))}
          </Stack>
        </Card>
        <Card>
          <Stack gap="sm">
            <Skeleton height={10} width={180} />
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} height={16} />
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
