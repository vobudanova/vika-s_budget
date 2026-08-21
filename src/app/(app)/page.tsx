import Link from 'next/link';
import { Box, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import {
  IconCalendarMonth,
  IconChartHistogram,
  IconHourglassLow,
  IconPigMoney,
  IconTrendingUp,
  IconWallet,
} from '@tabler/icons-react';
import { todayISO, ymOf, dateTitle, RU_MONTHS } from '@/lib/dates';
import { fmtMoney } from '@/lib/money';
import {
  getAccountBalances,
  getDayTransactions,
  getReference,
  splitBalances,
} from '@/queries/core';
import { Money } from '@/components/Money';
import { NewDayDrawer } from '@/components/NewDayDrawer';
import { categorySelectData } from '@/components/tx-helpers';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const today = todayISO();
  const ym = ymOf(today);
  const year = today.slice(0, 4);
  const [balances, dayTxs, ref] = await Promise.all([
    getAccountBalances(),
    getDayTransactions(today),
    getReference(today),
  ]);
  const { totalRub, totalUsd } = splitBalances(balances);
  const cats = categorySelectData(ref.groups, ref.categories);
  const defaultAccount = ref.accounts.find((a) => a.type === 'checking') ?? null;
  const monthName = RU_MONTHS[Number(ym.slice(5, 7)) - 1];

  const tiles = [
    { href: '/balance', label: 'Баланс', icon: <IconWallet size="1em" stroke={1.5} /> },
    { href: `/year/${year}`, label: year, icon: <IconChartHistogram size="1em" stroke={1.5} /> },
    { href: `/month/${ym}`, label: cap1(monthName), icon: <IconCalendarMonth size="1em" stroke={1.5} /> },
    { href: '/assets', label: 'Амортизация', icon: <IconHourglassLow size="1em" stroke={1.5} /> },
    { href: '/fund', label: 'КС', icon: <IconPigMoney size="1em" stroke={1.5} /> },
    { href: '/income', label: 'Доходы', icon: <IconTrendingUp size="1em" stroke={1.5} /> },
  ];

  return (
    <Stack gap="xl">
      {/* Заголовок по центру, круглая кнопка нового дня — у правого края */}
      <Box pos="relative" mt="xs" px={{ base: 54, sm: 0 }}>
        <Title order={1} ta="center" fw={400} fz={{ base: 21, xs: 26 }} style={{ whiteSpace: 'nowrap' }}>
          Привет, Виктория!
        </Title>
        <Box pos="absolute" right={{ base: -8, sm: 0 }} top="50%" style={{ transform: 'translateY(-50%)' }}>
          <NewDayDrawer
            date={today}
            dateTitle={dateTitle(today)}
            categories={cats}
            defaultAccountId={defaultAccount?.id ?? null}
            txs={dayTxs.slice(0, 8)}
          />
        </Box>
      </Box>

      {/* Баланс — без подложки, по центру */}
      <Stack gap={4} align="center" ta="center">
        <Money value={Math.round(totalRub)} fz={{ base: 28, xs: 36 }} fw={600} lts="-0.02em" />
        {totalUsd > 0 && (
          <Text c="dimmed" fz="sm" className="money">
            + {fmtMoney(totalUsd, 'USD')}
          </Text>
        )}
      </Stack>

      {/* Навигация: квадратные плитки — 2 в ряд на мобильном, 3 на широком.
          Размеры иконки и текста привязаны к ширине квадрата (container queries). */}
      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing={{ base: 'md', sm: 'xl' }}>
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="dash-link">
            <Paper
              className="dash-tile"
              p="md"
              style={{
                aspectRatio: '1 / 1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                containerType: 'inline-size',
              }}
            >
              <Stack gap="7cqw" align="center">
                <Text c="ink.7" lh={1} component="span" style={{ fontSize: 'clamp(30px, 17cqw, 56px)' }}>
                  {t.icon}
                </Text>
                <Text fw={400} lh={1.15} ta="center" style={{ fontSize: 'clamp(15px, 8.6cqw, 30px)' }}>
                  {t.label}
                </Text>
              </Stack>
            </Paper>
          </Link>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function cap1(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
