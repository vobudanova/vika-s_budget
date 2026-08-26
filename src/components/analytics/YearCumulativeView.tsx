'use client';

import { AreaChart } from '@mantine/charts';
import { Box, Card, Group, Progress, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import type { YearCumulative } from '@/queries/analytics-widgets';
import { CardLabel } from '@/components/CardLabel';
import { Money } from '@/components/Money';
import { fmtMoney, fmtMoneyShort, fmtNumber } from '@/lib/money';

/** Накопительная аналитика года: итоги с начала года, динамика по месяцам,
    раскладка по категориям. */
export function YearCumulativeView({ data }: { data: YearCumulative }) {
  const chart = data.months.map((m) => ({
    label: m.label,
    Получено: Math.round(m.cumReceived),
    Потрачено: Math.round(m.cumSpent),
  }));

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Card>
          <Stack gap={4}>
            <CardLabel>Потрачено с начала года</CardLabel>
            <Money value={Math.round(data.spent)} fz={22} fw={700} />
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>Получено с начала года</CardLabel>
            <Money value={Math.round(data.received)} fz={22} fw={700} c={data.received > 0 ? 'teal.8' : undefined} />
          </Stack>
        </Card>
        <Card>
          <Stack gap={4}>
            <CardLabel>Сбережено</CardLabel>
            <Money
              value={Math.round(data.saved)}
              fz={22}
              fw={700}
              c={data.saved >= 0 ? 'teal.8' : 'red.8'}
            />
            <Text fz="xs" c="dimmed">
              получено минус потрачено
            </Text>
          </Stack>
        </Card>
      </SimpleGrid>

      <Card>
        <Stack gap="sm">
          <CardLabel>Нарастающим итогом</CardLabel>
          {data.months.length === 0 ? (
            <Text fz="sm" c="dimmed">
              Данных за год пока нет.
            </Text>
          ) : (
            <AreaChart
              h={240}
              data={chart}
              dataKey="label"
              series={[
                { name: 'Получено', color: 'teal.6' },
                { name: 'Потрачено', color: 'ink.5' },
              ]}
              curveType="monotone"
              withLegend
              legendProps={{ verticalAlign: 'bottom', height: 30 }}
              fillOpacity={0.12}
              yAxisProps={{ tickFormatter: (v: number) => fmtMoneyShort(v), width: 46 }}
              valueFormatter={(v) => fmtMoney(Math.round(v))}
            />
          )}
        </Stack>
      </Card>

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>По месяцам</CardLabel>
            <div style={{ overflowX: 'auto' }}>
              <Table verticalSpacing={4} fz="sm" miw={430}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th ta="right">Потрачено</Table.Th>
                    <Table.Th ta="right">Получено</Table.Th>
                    <Table.Th ta="right">Сбережено</Table.Th>
                    <Table.Th ta="right">Σ сбережено</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.months.map((m) => (
                    <Table.Tr key={m.ym}>
                      <Table.Td tt="capitalize">{m.label}</Table.Td>
                      <Table.Td ta="right" className="money">
                        {fmtNumber(m.spent, 0)}
                      </Table.Td>
                      <Table.Td ta="right" className="money">
                        {fmtNumber(m.received, 0)}
                      </Table.Td>
                      <Table.Td ta="right" className="money" c={m.saved >= 0 ? 'teal.8' : 'red.8'}>
                        {fmtNumber(m.saved, 0)}
                      </Table.Td>
                      <Table.Td ta="right" className="money" fw={600} c={m.cumSaved >= 0 ? 'teal.8' : 'red.8'}>
                        {fmtNumber(m.cumSaved, 0)}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <CardLabel>По категориям · с начала года</CardLabel>
            {data.groups.length === 0 && (
              <Text fz="sm" c="dimmed">
                Трат пока нет.
              </Text>
            )}
            <Stack gap={10}>
              {data.groups.map((g) => (
                <Box key={g.name}>
                  <Group justify="space-between" mb={3} wrap="nowrap">
                    <Text fz="sm" truncate>
                      {g.name}
                    </Text>
                    <Text fz="sm" className="money" fw={500} style={{ flexShrink: 0 }}>
                      {fmtMoney(Math.round(g.total))}
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
