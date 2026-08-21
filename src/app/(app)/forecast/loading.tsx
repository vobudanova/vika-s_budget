import { SimpleGrid, Stack } from '@mantine/core';
import { HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={280} subtitleW={380} />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <TableCardSkeleton rows={5} />
        <TableCardSkeleton rows={5} />
        <TableCardSkeleton rows={4} />
      </SimpleGrid>
    </Stack>
  );
}
