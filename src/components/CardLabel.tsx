import { Text } from '@mantine/core';

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text fz={11} fw={600} tt="uppercase" c="dimmed" lts="0.07em">
      {children}
    </Text>
  );
}
