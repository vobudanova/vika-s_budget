import { SimpleGrid, Stack } from '@mantine/core';
import { GoalCardSkeleton, HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={90} subtitleW={380} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={4} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <GoalCardSkeleton />
        <GoalCardSkeleton />
        <GoalCardSkeleton />
        <GoalCardSkeleton />
      </SimpleGrid>
    </Stack>
  );
}
