import { SimpleGrid, Stack } from '@mantine/core';
import { HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={210} subtitleW={400} />
      <TableCardSkeleton rows={9} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <TableCardSkeleton rows={3} />
        <TableCardSkeleton rows={3} />
      </SimpleGrid>
    </Stack>
  );
}
