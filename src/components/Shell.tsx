'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  ScrollArea,
  Text,
  ActionIcon,
  Tooltip,
  Stack,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconLayoutDashboard,
  IconCirclePlus,
  IconCalendarMonth,
  IconChartHistogram,
  IconHourglassLow,
  IconTargetArrow,
  IconPigMoney,
  IconCrystalBall,
  IconTrendingUp,
  IconWallet,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';
import { logout } from '@/actions/auth';

type Item = { href: string; label: string; icon: React.ReactNode; exact?: boolean };

const NAV: { section: string | null; items: Item[] }[] = [
  {
    section: null,
    items: [
      { href: '/', label: 'Дашборд', icon: <IconLayoutDashboard size={18} stroke={1.6} />, exact: true },
      { href: '/day', label: 'Новый день', icon: <IconCirclePlus size={18} stroke={1.6} /> },
      { href: '/month', label: 'Месяц', icon: <IconCalendarMonth size={18} stroke={1.6} /> },
      { href: '/year', label: 'Год', icon: <IconChartHistogram size={18} stroke={1.6} /> },
    ],
  },
  {
    section: 'Фонды',
    items: [
      { href: '/assets', label: 'Амортизация', icon: <IconHourglassLow size={18} stroke={1.6} /> },
      { href: '/cap', label: 'КАП', icon: <IconTargetArrow size={18} stroke={1.6} /> },
      { href: '/fund', label: 'Фонд КС', icon: <IconPigMoney size={18} stroke={1.6} /> },
      { href: '/forecast', label: 'Прогноз', icon: <IconCrystalBall size={18} stroke={1.6} /> },
    ],
  },
  {
    section: 'Деньги',
    items: [
      { href: '/income', label: 'Доходы', icon: <IconTrendingUp size={18} stroke={1.6} /> },
      { href: '/accounts', label: 'Счета и сверка', icon: <IconWallet size={18} stroke={1.6} /> },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();

  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <AppShell
      header={{ height: 54 }}
      navbar={{ width: 224, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
      styles={{
        header: { backgroundColor: 'var(--paper)' },
        navbar: { backgroundColor: 'var(--paper)' },
        main: { backgroundColor: 'var(--paper)' },
      }}
    >
      <AppShell.Header withBorder={false}>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Меню" />
            <Text
              component={Link}
              href="/"
              fz={17}
              fw={600}
              lts="-0.02em"
              c="dark.8"
              style={{ textDecoration: 'none' }}
              onClick={close}
            >
              Вика
              <Text span inherit c="ink.7">
                .Финансы
              </Text>
            </Text>
          </Group>
          <form action={logout}>
            <Tooltip label="Выйти">
              <ActionIcon type="submit" variant="subtle" color="gray" aria-label="Выйти">
                <IconLogout size={18} stroke={1.6} />
              </ActionIcon>
            </Tooltip>
          </form>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm" withBorder={false}>
        <ScrollArea type="never" style={{ flex: 1 }}>
          <Stack gap="xs">
            {NAV.map((group, i) => (
              <Box key={i}>
                {group.section && (
                  <Text fz={11} fw={600} tt="uppercase" c="dimmed" lts="0.08em" px="sm" pt="xs" pb={4}>
                    {group.section}
                  </Text>
                )}
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    component={Link}
                    href={item.href}
                    label={item.label}
                    leftSection={item.icon}
                    active={isActive(item)}
                    onClick={close}
                    fw={500}
                    style={{ borderRadius: 'var(--mantine-radius-md)' }}
                  />
                ))}
              </Box>
            ))}
          </Stack>
        </ScrollArea>
        <NavLink
          component={Link}
          href="/settings"
          label="Настройки"
          leftSection={<IconSettings size={18} stroke={1.6} />}
          active={pathname.startsWith('/settings')}
          onClick={close}
          fw={500}
          style={{ borderRadius: 'var(--mantine-radius-md)' }}
        />
      </AppShell.Navbar>

      <AppShell.Main>
        <Box maw={1060} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
