'use client';

import { BarChart, LineChart } from '@mantine/charts';
import { Box, Group, Text, Tooltip } from '@mantine/core';
import { fmtMoney } from '@/lib/money';
import { RU_MONTHS, RU_MONTHS_GEN } from '@/lib/dates';

/** Годовая тепловая карта трат: блоки-месяцы с подписями, внутри — недели-колонки. */
export function YearHeatmap({ heat }: { heat: { date: string; amount: number }[] }) {
  const byDate = new Map(heat.map((h) => [h.date, h.amount]));
  if (heat.length === 0)
    return (
      <Text fz="sm" c="dimmed">
        Пока нет данных для карты.
      </Text>
    );

  const first = new Date(heat[0].date);
  const last = new Date(heat[heat.length - 1].date);

  const positives = heat.map((h) => h.amount).filter((v) => v > 0).sort((a, b) => a - b);
  const q = (p: number) => positives[Math.floor(positives.length * p)] ?? 0;
  const t1 = q(0.4);
  const t2 = q(0.7);
  const t3 = q(0.9);
  const colorFor = (v: number) => {
    if (v <= 0) return 'var(--mantine-color-gray-1)';
    if (v <= t1) return 'var(--mantine-color-ink-1)';
    if (v <= t2) return 'var(--mantine-color-ink-3)';
    if (v <= t3) return 'var(--mantine-color-ink-5)';
    return 'var(--mantine-color-ink-7)';
  };

  // помесячные блоки: недели месяца — колонки, пустые ячейки выравнивают дни недели
  const months: { key: string; label: string; weeks: (Date | null)[][] }[] = [];
  const mCursor = new Date(first.getFullYear(), first.getMonth(), 1);
  while (mCursor <= last) {
    const y = mCursor.getFullYear();
    const mo = mCursor.getMonth();
    const daysCnt = new Date(y, mo + 1, 0).getDate();
    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = new Array((new Date(y, mo, 1).getDay() + 6) % 7).fill(null);
    for (let d = 1; d <= daysCnt; d++) {
      week.push(new Date(y, mo, d));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    months.push({ key: `${y}-${mo}`, label: RU_MONTHS[mo].slice(0, 3), weeks });
    mCursor.setMonth(mo + 1);
  }

  const cell = { width: '100%', aspectRatio: '1 / 1', borderRadius: 3 } as const;
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Group gap={10} wrap="nowrap" align="flex-start" style={{ minWidth: 640 }}>
        {months.map((m) => (
          <Box key={m.key} style={{ flex: `${m.weeks.length} 1 0%`, minWidth: 0 }}>
            <Text fz={10} c="dimmed" mb={4} lh={1}>
              {m.label}
            </Text>
            <Box style={{ display: 'flex', gap: 3 }}>
              {m.weeks.map((week, wi) => (
                <Box key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  {week.map((d, di) => {
                    if (!d) return <Box key={di} style={cell} />;
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const v = byDate.get(iso) ?? 0;
                    const inRange = d >= first && d <= last;
                    if (!inRange) return <Box key={di} style={cell} />;
                    return (
                      <Tooltip
                        key={di}
                        label={`${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} · ${v > 0 ? fmtMoney(Math.round(v)) : 'без трат'}`}
                        openDelay={150}
                      >
                        <Box style={{ ...cell, background: colorFor(v) }} />
                      </Tooltip>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Group>
    </Box>
  );
}

export function WeekdayChart({ weekday }: { weekday: { label: string; avg: number }[] }) {
  return (
    <BarChart
      h={150}
      data={weekday.map((w) => ({ label: w.label, 'Средний расход': w.avg }))}
      dataKey="label"
      series={[{ name: 'Средний расход', color: 'ink.4' }]}
      withYAxis={false}
      gridAxis="none"
      barProps={{ radius: 4 }}
      valueFormatter={(v) => fmtMoney(Math.round(v))}
    />
  );
}

export function CapexChart({ data }: { data: { label: string; pct: number }[] }) {
  return (
    <BarChart
      h={130}
      data={data.map((d) => ({ label: d.label, 'Доля покупок': d.pct }))}
      dataKey="label"
      series={[{ name: 'Доля покупок', color: 'yellow.6' }]}
      withYAxis={false}
      gridAxis="none"
      barProps={{ radius: 3 }}
      valueFormatter={(v) => `${v}%`}
    />
  );
}

export function InflationChart({
  series,
}: {
  series: { label: string; Продукты: number | null; Кафе: number | null }[];
}) {
  return (
    <LineChart
      h={170}
      data={series}
      dataKey="label"
      series={[
        { name: 'Продукты', color: 'ink.5' },
        { name: 'Кафе', color: 'violet.4' },
      ]}
      curveType="monotone"
      connectNulls
      withLegend
      legendProps={{ verticalAlign: 'bottom', height: 26 }}
      valueFormatter={(v) => fmtMoney(Math.round(v))}
    />
  );
}

/** Карта заполненности года: зелёно-лососёвая — день отмечен, оранжевая —
    операции без отметки, серая — пусто; будущие дни не рисуются. */
export function FillHeatmap({ days }: { days: { date: string; status: 0 | 1 | 2 }[] }) {
  if (days.length === 0)
    return (
      <Text fz="sm" c="dimmed">
        Нет данных.
      </Text>
    );
  const byDate = new Map(days.map((d) => [d.date, d.status]));
  const first = new Date(days[0].date);
  const last = new Date(days[days.length - 1].date);

  const STATUS_BG = [
    'var(--mantine-color-gray-2)', // пусто
    'var(--mantine-color-orange-4)', // операции без отметки
    'var(--mantine-color-ink-4)', // отмечен
  ];
  const STATUS_LABEL = ['пусто', 'есть операции, нет отметки', 'заполнен'];

  const months: { key: string; label: string; weeks: (Date | null)[][] }[] = [];
  const mCursor = new Date(first.getFullYear(), first.getMonth(), 1);
  while (mCursor <= last) {
    const y = mCursor.getFullYear();
    const mo = mCursor.getMonth();
    const daysCnt = new Date(y, mo + 1, 0).getDate();
    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = new Array((new Date(y, mo, 1).getDay() + 6) % 7).fill(null);
    for (let d = 1; d <= daysCnt; d++) {
      week.push(new Date(y, mo, d));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    months.push({ key: `${y}-${mo}`, label: RU_MONTHS[mo].slice(0, 3), weeks });
    mCursor.setMonth(mo + 1);
  }

  const cell = { width: '100%', aspectRatio: '1 / 1', borderRadius: 3 } as const;
  return (
    <Box style={{ overflowX: 'auto' }}>
      <Group gap={10} wrap="nowrap" align="flex-start" style={{ minWidth: 640 }}>
        {months.map((m) => (
          <Box key={m.key} style={{ flex: `${m.weeks.length} 1 0%`, minWidth: 0 }}>
            <Text fz={10} c="dimmed" mb={4} lh={1}>
              {m.label}
            </Text>
            <Box style={{ display: 'flex', gap: 3 }}>
              {m.weeks.map((week, wi) => (
                <Box key={wi} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  {week.map((d, di) => {
                    if (!d) return <Box key={di} style={cell} />;
                    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    const status = byDate.get(iso);
                    if (status === undefined) return <Box key={di} style={cell} />;
                    return (
                      <Tooltip
                        key={di}
                        label={`${d.getDate()} ${RU_MONTHS_GEN[d.getMonth()]} · ${STATUS_LABEL[status]}`}
                        openDelay={150}
                      >
                        <Box style={{ ...cell, background: STATUS_BG[status] }} />
                      </Tooltip>
                    );
                  })}
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Group>
    </Box>
  );
}
