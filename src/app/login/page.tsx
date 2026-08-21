'use client';

import { useActionState } from 'react';
import {
  Box,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { login, type LoginState } from '@/actions/auth';

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <Center mih="100dvh" p="md">
      <Box w="100%" maw={380}>
        <Stack gap="lg">
          <Stack gap={4} align="center">
            <Title order={1} fz={30} fw={600} lts="-0.02em">
              Вика
              <Text span inherit c="ink.7">
                .Salmon
              </Text>
            </Title>
            <Text c="dimmed" fz="sm">
              Личный кабинет
            </Text>
          </Stack>
          <Paper p="lg">
            <form action={formAction}>
              <Stack gap="md">
                <PasswordInput
                  name="password"
                  label="Пароль"
                  placeholder="Введите пароль"
                  autoFocus
                  required
                  error={state.error}
                  size="md"
                />
                <Button type="submit" loading={pending} size="md" fullWidth>
                  Войти
                </Button>
              </Stack>
            </form>
          </Paper>
        </Stack>
      </Box>
    </Center>
  );
}
