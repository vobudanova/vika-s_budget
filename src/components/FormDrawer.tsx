'use client';

import { Drawer, Text, em } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

/**
 * Универсальный контейнер форм: на мобильном выезжает снизу (85% высоты —
 * страница остаётся видна сверху), на десктопе — справа.
 */
export function FormDrawer({
  opened,
  onClose,
  title,
  children,
  desktopSize = 'md',
}: {
  opened: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  desktopSize?: string | number;
}) {
  const isMobile = useMediaQuery(`(max-width: ${em(768)})`, false);

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position={isMobile ? 'bottom' : 'right'}
      size={isMobile ? '85%' : desktopSize}
      padding="lg"
      // авто-фокус при открытии попадал на крестик и рисовал фокус-обводку;
      // Esc и клик закрывают как раньше, в формах фокус сразу в первое поле
      closeButtonProps={{ tabIndex: -1 }}
      title={
        typeof title === 'string' ? (
          <Text fw={600} fz="md">
            {title}
          </Text>
        ) : (
          title
        )
      }
      styles={
        isMobile
          ? {
              content: {
                borderTopLeftRadius: 'var(--mantine-radius-lg)',
                borderTopRightRadius: 'var(--mantine-radius-lg)',
              },
            }
          : undefined
      }
    >
      {children}
    </Drawer>
  );
}
