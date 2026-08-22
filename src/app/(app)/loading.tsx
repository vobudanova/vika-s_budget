import { Box, SimpleGrid, Skeleton, Stack } from '@mantine/core';

/** Скелет дашборда: приветствие + круглая кнопка, сумма, шесть квадратных плиток. */
export default function Loading() {
  return (
    <Stack gap="xl">
      <Box pos="relative" mt="xs">
        <Stack align="center" justify="center" h={46}>
          <Skeleton height={24} width={210} />
        </Stack>
        <Box pos="absolute" right={{ base: -8, sm: 0 }} top="50%" style={{ transform: 'translateY(-50%)' }}>
          <Skeleton height={46} width={46} radius="50%" />
        </Box>
      </Box>

      <Stack gap={4} align="center">
        <Skeleton height={34} width={190} />
      </Stack>

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={{ base: 'md', sm: 'xl' }}>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} radius="lg" width="100%" height="auto" style={{ aspectRatio: '1 / 1' }} />
        ))}
      </SimpleGrid>
    </Stack>
  );
}
