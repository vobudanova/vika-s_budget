import { Stack } from '@mantine/core';
import { HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={190} subtitleW={330} rightW={160} />
      <TableCardSkeleton rows={6} />
      <TableCardSkeleton rows={4} />
    </Stack>
  );
}
