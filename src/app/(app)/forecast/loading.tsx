import { Card, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Stack gap="md">
      <Stack gap={6}>
        <Skeleton height={26} width={220} />
        <Skeleton height={14} width={320} />
      </Stack>
      {[0, 1].map((i) => (
        <Card key={i}>
          <Stack gap={10}>
            <Skeleton height={12} width={140} />
            <Skeleton height={16} />
            <Skeleton height={16} />
            <Skeleton height={16} width="70%" />
          </Stack>
        </Card>
      ))}
    </Stack>
  );
}
