import { Group, Stack, Text, Title } from '@mantine/core';

export function PageHeader({
  title,
  subtitle,
  beside,
  right,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** элемент рядом с заголовком (например, переключатель видов) */
  beside?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" gap="sm">
      <Stack gap={2}>
        <Group gap="md" align="center" wrap="wrap">
          <Title order={1}>{title}</Title>
          {beside}
        </Group>
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
