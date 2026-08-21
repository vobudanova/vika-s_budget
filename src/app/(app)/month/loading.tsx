import { Stack } from '@mantine/core';
import { HeaderSkeleton, MatrixSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={200} subtitleW={300} rightW={300} />
      <MatrixSkeleton />
    </Stack>
  );
}
