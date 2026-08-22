import { SimpleGrid, Skeleton, Stack } from '@mantine/core';
import { TableCardSkeleton } from '@/components/skeletons';

/** Скелет баланса: сумма по центру, 4 группы счетов, сверка, вклады и долги. */
export default function Loading() {
  return (
    <Stack gap="xl">
      <Stack gap={10} align="center" pt="md">
        <Skeleton height={12} width={140} />
        <Skeleton height={52} width={340} />
        <Skeleton height={14} width={200} />
      </Stack>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={2} />
        <TableCardSkeleton rows={4} />
      </SimpleGrid>
      <TableCardSkeleton rows={8} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={3} />
      </SimpleGrid>
    </Stack>
  );
}
