import { Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
        <HeaderSkeleton titleW={130} subtitleW={340} />
        <Group gap="xs">
          <Skeleton height={34} width={150} />
          <Skeleton height={34} width={130} />
        </Group>
      </Group>
      <TableCardSkeleton rows={12} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <TableCardSkeleton rows={5} />
        <TableCardSkeleton rows={5} />
      </SimpleGrid>
    </Stack>
  );
}
