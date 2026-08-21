import { SimpleGrid, Stack } from '@mantine/core';
import { FormCardSkeleton, HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={130} subtitleW={380} />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <FormCardSkeleton fields={3} />
        <FormCardSkeleton fields={3} />
      </SimpleGrid>
      <TableCardSkeleton rows={6} />
    </Stack>
  );
}
