import { Group, Stack, Skeleton } from '@mantine/core';
import { HeaderSkeleton, TableCardSkeleton } from '@/components/skeletons';

export default function Loading() {
  return (
    <Stack gap="md">
      <HeaderSkeleton titleW={140} subtitleW={380} rightW={140} />
      <Group gap="sm">
        <Skeleton height={28} width={210} />
        <Skeleton height={16} width={180} />
      </Group>
      <TableCardSkeleton rows={11} header={false} />
    </Stack>
  );
}
