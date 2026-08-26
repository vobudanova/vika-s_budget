'use client';

import { AreaChart } from '@mantine/charts';
import { Box, Card, Group, Progress, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBulb,
  IconSparkles,
  IconTrophy,
} from '@tabler/icons-react';
import type { Analytics, Insight } from '@/queries/analytics';
import { CardLabel } from '@/components/CardLabel';
import { Money } from '@/components/Money';
import { fmtMoney, fmtMoneyShort } from '@/lib/money';

const INSIGHT_META: Record<Insight['kind'], { icon: React.ReactNode; color: string; label: string }> = {
  finding: { icon: <IconBulb size={16} stroke={1.8} />, color: 'ink', label: 'наблюдение' },
  advice: { icon: <IconSparkles size={16} stroke={1.8} />, color: 'teal', label: 'совет' },
  warning: { icon: <IconAlertTriangle size={16} stroke={1.8} />, color: 'orange', label: 'внимание' },
  record: { icon: <IconTrophy size={16} stroke={1.8} />, color: 'grape', label: 'рекорд' },
};

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev <= 0 || current <= 0) return null;
  const diff = ((current - prev) / prev) * 100;
  if (Math.abs(diff) < 1) return null;
  const up = diff > 0;
  return (
    <Group gap={2} wrap="nowrap" c={up ? 'red.7' : 'teal.8'}>
      {up ? <IconArrowUpRight size={14} stroke={2} /> : <IconArrowDownRight size={14} stroke={2} />}
      <Text fz="xs" fw={600} className="money">
        {Math.abs(diff) >= 100 ? `×${(current / prev).toFixed(1)}` : `${Math.round(Math.abs(diff))}%`}
      </Text>
    </Group>
  );
}

/** Тренд-карта «Последние 12 месяцев» — живёт на вкладке «Тренды». */
export function TrendCard({
  months,
}: {
  months: { label: string; actual: number; accrued: number; income: number }[];
}) {
  const monthsData = months.map((m) => ({
    label: m.label,
    Фактические: Math.round(m.actual),
    Начисленные: Math.round(m.accrued),
    Доходы: Math.round(m.income),
  }));
  const hasHistory = months.filter((m) => m.actual > 0).length >= 2;
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Последние 12 месяцев</CardLabel>
        {hasHistory ? (
          <AreaChart
            h={240}
            data={monthsData}
            dataKey="label"
            series={[
              { name: 'Доходы', color: 'teal.6' },
              { name: 'Фактические', color: 'ink.5' },
              { name: 'Начисленные', color: 'violet.4' },
            ]}
            curveType="monotone"
            withLegend
            legendProps={{ verticalAlign: 'bottom', height: 30 }}
            fillOpacity={0.12}
            yAxisProps={{ tickFormatter: (v: number) => fmtMoneyShort(v), width: 46 }}
            valueFormatter={(v) => fmtMoney(Math.round(v))}
          />
        ) : (
          <Text fz="sm" c="dimmed">
            Тренд появится, когда накопится история хотя бы за два месяца.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export function AnalyticsView({ a }: { a: Analytics }) {

  return (
    <Stack gap="md">
      {/* — сводка месяца — */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <Card>
          <Stack gap={4}>
            <CardLabel>Фактические</CardLabel>
            <Group gap="xs" align="baseline" wrap="nowrap">
              <Money value={Math.round(a.actualMonth)} fz={22} fw={700} />
              <DeltaBadge current={a.actualMonth} prev={a.actualPrev} />
            </Group>
            <Text fz="xs" c="dimmed" className="money">
              {a.avgPerDay > 0 ? `${fmtMoney(Math.round(a.avgPerDay))}/день` : 'трат пока нет'}
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>Начисленные</CardLabel>
            <Money value={Math.round(a.accruedMonth)} fz={22} fw={700} />
            <Text fz="xs" c="dimmed">
              траты + амортизация
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>Доходы</CardLabel>
            <Money value={Math.round(a.incomeMonth)} fz={22} fw={700} c={a.incomeMonth > 0 ? 'teal.8' : undefined} />
            <Text fz="xs" c="dimmed" className="money">
              {a.incomeMonth > 0 && a.actualMonth > 0
                ? `баланс месяца ${fmtMoney(Math.round(a.incomeMonth - a.actualMonth))}`
                : '—'}
            </Text>
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>{a.forecastMonth ? 'Прогноз месяца' : 'Отложено'}</CardLabel>
            {a.forecastMonth ? (
              <>
                <Money value={Math.round(a.forecastMonth)} fz={22} fw={700} c="ink.7" />
                <Text fz="xs" c="dimmed">
                  в текущем темпе, {a.daysPassed} из {a.daysInMonth} дн.
                </Text>
              </>
            ) : (
              <>
                <Money value={Math.round(a.savedMonth)} fz={22} fw={700} />
                <Text fz="xs" c="dimmed">
                  на сбережения и вклады
                </Text>
              </>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {/* — находки — */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {a.insights.map((ins, i) => {
          const meta = INSIGHT_META[ins.kind];
          return (
            <Card key={i} padding="md">
              <Group gap="sm" wrap="nowrap" align="flex-start">
                <ThemeIcon variant="light" color={meta.color} size={32} radius="md">
                  {meta.icon}
                </ThemeIcon>
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fz="sm" fw={600} lh={1.3}>
                    {ins.title}
                  </Text>
                  <Text fz="xs" c="dimmed" lh={1.45}>
                    {ins.text}
                  </Text>
                </Stack>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      {/* — структура по группам — */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>Структура месяца</CardLabel>
            {a.groups.length === 0 && (
              <Text fz="sm" c="dimmed">
                Категорийных трат пока нет.
              </Text>
            )}
            <Stack gap={10}>
              {a.groups.slice(0, 8).map((g) => (
                <Box key={g.name}>
                  <Group justify="space-between" mb={3} wrap="nowrap">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                      <Text fz="sm" truncate>
                        {g.name}
                      </Text>
                      <DeltaBadge current={g.current} prev={g.prev} />
                    </Group>
                    <Text fz="sm" className="money" fw={500} style={{ flexShrink: 0 }}>
                      {fmtMoney(Math.round(g.current))}
                      <Text span fz="xs" c="dimmed" className="money">
                        {' '}
                        · {Math.round(g.share * 100)}%
                      </Text>
                    </Text>
                  </Group>
                  <Progress value={g.share * 100} size={6} radius="xl" color="ink.4" />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Card>

      </SimpleGrid>
    </Stack>
  );
}
