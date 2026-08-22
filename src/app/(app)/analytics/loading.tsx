import { Card, Group, SimpleGrid, Skeleton, Stack } from '@mantine/core';

/** Скелет трендов: заголовок с переключателем, большой график, виджеты. */
export default function Loading() {
  return (
    <Stack gap="md">
      <Group gap="md" align="center" wrap="wrap">
        <Skeleton height={30} width={180} />
        <Skeleton height={32} width={150} radius="sm" />
      </Group>
      <Card>
        <Stack gap="sm">
          <Skeleton height={10} width={160} />
          <Skeleton height={240} />
        </Stack>
      </Card>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {Array.from({ length: 2 }, (_, i) => (
          <Card key={i}>
            <Stack gap="sm">
              <Skeleton height={10} width={150} />
              {Array.from({ length: 5 }, (_, j) => (
                <Skeleton key={j} height={13} width={`${90 - j * 12}%`} />
              ))}
            </Stack>
          </Card>
        ))}
      </SimpleGrid>
      <Card>
        <Stack gap="sm">
          <Skeleton height={10} width={140} />
          <Skeleton height={100} />
        </Stack>
      </Card>
    </Stack>
  );
}
