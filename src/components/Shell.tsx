'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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
  IconScale,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';
import { logout } from '@/actions/auth';
import { PullToRefresh } from './PullToRefresh';

type Item = { href: string; prefix: string; label: string; icon: React.ReactNode; exact?: boolean };

/** Сегодня в поясе браузера — для прямых ссылок без промежуточных redirect-страниц. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [opened, { toggle, close }] = useDisclosure();
  const pathname = usePathname();
  // Дата вычисляется после mount, чтобы не расходиться с SSR-разметкой
  const [today, setToday] = useState<string | null>(null);
  useEffect(() => setToday(localToday()), []);

  const NAV: { section: string | null; items: Item[] }[] = [
    {
      section: null,
      items: [
        { href: '/', prefix: '/', label: 'Дашборд', icon: <IconLayoutDashboard size={18} stroke={1.6} />, exact: true },
        { href: today ? `/day/${today}` : '/day', prefix: '/day', label: 'Новый день', icon: <IconCirclePlus size={18} stroke={1.6} /> },
        { href: today ? `/month/${today.slice(0, 7)}` : '/month', prefix: '/month', label: 'Месяц', icon: <IconCalendarMonth size={18} stroke={1.6} /> },
        { href: today ? `/year/${today.slice(0, 4)}` : '/year', prefix: '/year', label: 'Год', icon: <IconChartHistogram size={18} stroke={1.6} /> },
      ],
    },
    {
      section: 'Фонды',
      items: [
        { href: '/assets', prefix: '/assets', label: 'Амортизация', icon: <IconHourglassLow size={18} stroke={1.6} /> },
        { href: '/cap', prefix: '/cap', label: 'КАП', icon: <IconTargetArrow size={18} stroke={1.6} /> },
        { href: '/fund', prefix: '/fund', label: 'Фонд КС', icon: <IconPigMoney size={18} stroke={1.6} /> },
        { href: '/forecast', prefix: '/forecast', label: 'Прогноз', icon: <IconCrystalBall size={18} stroke={1.6} /> },
      ],
    },
    {
      section: 'Деньги',
      items: [
        { href: '/balance', prefix: '/balance', label: 'Баланс', icon: <IconWallet size={18} stroke={1.6} /> },
        { href: '/income', prefix: '/income', label: 'Доходы', icon: <IconTrendingUp size={18} stroke={1.6} /> },
        { href: '/accounts', prefix: '/accounts', label: 'Счета и сверка', icon: <IconScale size={18} stroke={1.6} /> },
      ],
    },
  ];

  const isActive = (item: Item) =>
    item.exact ? pathname === item.href : pathname === item.prefix || pathname.startsWith(item.prefix + '/');

  // Широкие страницы-листы: контент без ограничения по ширине
  const wide = pathname.startsWith('/month') || pathname.startsWith('/year');

  return (
    <AppShell
      // высота шапки включает safe-area сверху (standalone на iPhone)
      header={{ height: 'calc(54px + env(safe-area-inset-top, 0px))' }}
      navbar={{ width: 224, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
      styles={{
        header: { backgroundColor: 'var(--paper)' },
        navbar: { backgroundColor: 'var(--paper)' },
        main: { backgroundColor: 'var(--paper)' },
      }}
    >
      <AppShell.Header withBorder={false}>
        <Group
          h="100%"
          px="md"
          justify="space-between"
          wrap="nowrap"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
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
                .Salmon
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

      <AppShell.Navbar
        withBorder={false}
        style={{
          padding: 'var(--mantine-spacing-sm)',
          // p="sm" даёт инлайновый padding и перебил бы safe-area из globals.css
          paddingBottom: 'calc(var(--mantine-spacing-sm) + env(safe-area-inset-bottom, 0px))',
        }}
      >
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
        <PullToRefresh />
        {/* Таблицы месяца и года разворачиваются на всю ширину экрана */}
        <Box maw={wide ? undefined : 1060} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
