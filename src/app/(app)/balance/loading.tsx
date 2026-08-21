import { SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="xl" align="center">
      <Stack gap={10} align="center" pt="md">
        <Skeleton height={12} width={140} />
        <Skeleton height={52} width={340} />
        <Skeleton height={14} width={200} />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" w="100%">
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={2} />
        <TableCardSkeleton rows={4} />
      </SimpleGrid>
    </Stack>
  );
}
