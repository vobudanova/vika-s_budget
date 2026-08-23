'use client';

import { BarChart, LineChart } from '@mantine/charts';
import { useState } from 'react';
import { ActionIcon, Box, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { fmtMoney } from '@/lib/money';
import { RU_MONTHS, RU_MONTHS_GEN } from '@/lib/dates';


const INFLATION_COLORS = ['ink.5', 'violet.4', 'teal.6', 'orange.5', 'blue.4', 'grape.4'];

/** Средние чеки по категориям; клик по чипу скрывает/показывает линию. */
export function InflationChart({
  series,
  names,
  changes,
}: {
  series: Record<string, string | number | null>[];
  names: string[];
  changes: Record<string, number | null>;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else if (next.size < names.length - 1) next.add(name); // хотя бы одна линия остаётся
      return next;
    });
  const visible = names.filter((n) => !hidden.has(n));
  return (
    <>
      <Group gap={6} wrap="wrap">
        {names.map((name, i) => {
          const off = hidden.has(name);
          const change = changes[name];
          return (
            <UnstyledButton
              key={name}
              onClick={() => toggle(name)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 999,
                border: '1px solid var(--ink-line)',
                background: off ? 'transparent' : 'var(--mantine-color-gray-0)',
                opacity: off ? 0.45 : 1,
              }}
              aria-pressed={!off}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  background: `var(--mantine-color-${INFLATION_COLORS[i % INFLATION_COLORS.length].replace('.', '-')})`,
                }}
              />
              <Text fz="xs" td={off ? 'line-through' : undefined}>
                {name}
              </Text>
              {change !== null && change !== undefined && !off && (
                <Text fz="xs" fw={600} className="money" c={change > 0 ? 'red.7' : 'teal.8'}>
                  {change > 0 ? '+' : ''}
                  {change}%
                </Text>
              )}
            </UnstyledButton>
          );
        })}
      </Group>
      <LineChart
        h={200}
        data={series}
        dataKey="label"
        series={visible.map((name) => ({
          name,
          color: INFLATION_COLORS[names.indexOf(name) % INFLATION_COLORS.length],
        }))}
        curveType="monotone"
        connectNulls
        valueFormatter={(v) => fmtMoney(Math.round(v))}
      />
    </>
  );
}

/** Карта заполненности года: зелёно-лососёвая — день отмечен, оранжевая —
    операции без отметки, серая — пусто; будущие дни не рисуются. */
export function FillHeatmap({ year, days }: { year: number; days: { date: string; status: 0 | 1 | 2 }[] }) {
  if (days.length === 0)
    return (
      <Text fz="sm" c="dimmed">
        Нет данных.
      </Text>
    );
  const byDate = new Map(days.map((d) => [d.date, d.status]));

  const STATUS_BG = [
    'var(--mantine-color-gray-2)', // пусто
    'var(--mantine-color-orange-4)', // операции без отметки
    'var(--mantine-color-ink-4)', // отмечен
  ];
  const STATUS_LABEL = ['пусто', 'есть операции, нет отметки', 'заполнен'];

  // всегда полный год: январь–декабрь, дни вне данных — пустые ячейки
  const months: { key: string; label: string; weeks: (Date | null)[][] }[] = [];
  for (let mo = 0; mo < 12; mo++) {
    const daysCnt = new Date(year, mo + 1, 0).getDate();
    const weeks: (Date | null)[][] = [];
    let week: (Date | null)[] = new Array((new Date(year, mo, 1).getDay() + 6) % 7).fill(null);
    for (let d = 1; d <= daysCnt; d++) {
      week.push(new Date(year, mo, d));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }
    months.push({ key: `${year}-${mo}`, label: RU_MONTHS[mo].slice(0, 3), weeks });
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

/** Один год заполненности с перелистыванием стрелками. */
export function FillYearsBrowser({
  years,
}: {
  years: { year: number; days: { date: string; status: 0 | 1 | 2 }[]; filled: number; passed: number }[];
}) {
  const [idx, setIdx] = useState(years.length - 1);
  const y = years[idx];
  if (!y) return null;
  const pct = Math.round((y.filled / Math.max(y.passed, 1)) * 100);
  return (
    <>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" align="baseline">
          <Text fw={700} fz="sm" className="money">
            {y.year}
          </Text>
          <Text fz="xs" className="money" c={pct >= 80 ? 'teal.8' : pct >= 40 ? 'orange.8' : 'red.8'}>
            отмечено {y.filled} из {y.passed} ({pct}%)
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap">
          <ActionIcon variant="default" size="sm" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="Предыдущий год">
            <IconChevronLeft size={14} />
          </ActionIcon>
          <ActionIcon
            variant="default"
            size="sm"
            disabled={idx === years.length - 1}
            onClick={() => setIdx(idx + 1)}
            aria-label="Следующий год"
          >
            <IconChevronRight size={14} />
          </ActionIcon>
        </Group>
      </Group>
      <FillHeatmap year={y.year} days={y.days} />
    </>
  );
}
