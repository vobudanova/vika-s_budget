'use client';

import Link from 'next/link';
import { Button, Stack, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';

/** Тело страницы 404 — используется и в Shell, и на отдельной странице. */
export function NotFoundView() {
  return (
    <Stack align="center" gap="sm" py={56}>
      <Text fz={72} fw={700} lh={1} c="ink.3" className="money">
        404
      </Text>
      <Title order={2}>Такой страницы нет</Title>
      <Text c="dimmed" fz="sm" ta="center" maw={340}>
        Возможно, в адресе опечатка или ссылка устарела.
      </Text>
      <Button component={Link} href="/" leftSection={<IconArrowLeft size={16} stroke={1.8} />} mt="xs">
        На дашборд
      </Button>
    </Stack>
  );
}
