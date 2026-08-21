import { Card, SimpleGrid, Skeleton, Stack } from '@mantine/core';

export default function Loading() {
  return (
    <Stack gap="lg">
      <Stack gap={6}>
        <Skeleton height={28} width={260} />
        <Skeleton height={14} width={180} />
      </Stack>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {[0, 1].map((i) => (
          <Card key={i}>
            <Stack gap="sm">
              <Skeleton height={12} width={140} />
              <Skeleton height={34} width={200} />
              <Skeleton height={12} />
              <Skeleton height={12} />
              <Skeleton height={12} width="70%" />
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <Stack gap="sm">
              <Skeleton height={12} width={120} />
              <Skeleton height={28} width={140} />
              <Skeleton height={10} width={100} />
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
