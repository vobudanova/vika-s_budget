import { Group, Skeleton, Stack } from '@mantine/core';
import { HeaderSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={170} subtitleW={230} />
      <Group gap="sm">
        {[70, 100, 90, 150, 70].map((w, i) => (
          <Skeleton key={i} height={30} width={w} />
        ))}
      </Group>
      <Skeleton height={36} width={420} />
      <Skeleton height={36} width={420} />
      <Skeleton height={34} width={140} />
    </Stack>
  );
}
