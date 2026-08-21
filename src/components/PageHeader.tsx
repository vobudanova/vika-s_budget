import { Group, Stack, Text, Title } from '@mantine/core';

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-end" mb="md" wrap="wrap" gap="sm">
      <Stack gap={2}>
        <Title order={1}>{title}</Title>
        {subtitle ? (
          <Text c="dimmed" fz="sm">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
      {right}
    </Group>
  );
}
