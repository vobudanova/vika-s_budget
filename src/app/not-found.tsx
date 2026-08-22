import { Box, Center, Stack, Text, Title } from '@mantine/core';
import { NotFoundView } from '@/components/NotFoundView';

export const metadata = { title: 'Страница не найдена' };

/** Глобальная 404 — вне оболочки приложения (неизвестные адреса). */
export default function NotFound() {
  return (
    <Center mih="100dvh" p="md">
      <Box w="100%" maw={380}>
        <Stack gap={0} align="center">
          <Title order={1} fz={30} fw={600} lts="-0.02em">
            Вика
            <Text span inherit c="ink.7">
              .Salmon
            </Text>
          </Title>
          <NotFoundView />
        </Stack>
      </Box>
    </Center>
  );
}
