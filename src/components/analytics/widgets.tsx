import { Badge, Card, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core';
import { CardLabel } from '@/components/CardLabel';
import { Money } from '@/components/Money';
import {
  getCompareWidget,
  getForecastWidget,
  getFundsWidget,
  getHygieneWidget,
  getInflationWidget,
  getRhythmWidget,
  getAnomalies,
  getCapMonths,
  getFillWidget,
  getMomTiles,
  getSavingsNext,
  getThingsWidget,
  getTrendSeries,
} from '@/queries/analytics-widgets';
import { CapexChart, FillYearsBrowser, InflationChart, WeekdayChart, YearHeatmap } from './widget-charts';
import { TrendCard } from './AnalyticsView';
import { fmtMoney, fmtMoneyExact } from '@/lib/money';

const money0 = (v: number) => fmtMoney(Math.round(v));
const moneyE = (v: number) => fmtMoneyExact(v);

function Row({ left, right, last }: { left: React.ReactNode; right: React.ReactNode; last?: boolean }) {
  return (
    <Group
      justify="space-between"
      wrap="nowrap"
      py={6}
      gap="md"
      style={{ borderBottom: last ? 'none' : '1px solid var(--ink-line)' }}
    >
      {left}
      {right}
    </Group>
  );
}

/** Скелет виджета: заголовок + строки/область. */
export function WidgetSkeleton({ lines = 4, chart = 0 }: { lines?: number; chart?: number }) {
  return (
    <Card>
      <Stack gap="sm">
        <Skeleton height={10} width={150} />
        {chart > 0 && <Skeleton height={chart} />}
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} height={13} width={`${90 - i * 12}%`} />
        ))}
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ вещи

export async function ThingsWidget({ ym }: { ym: string }) {
  const d = await getThingsWidget(ym);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Доля покупок в расходах</CardLabel>
        <CapexChart data={d.capexShare} />
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ ритмы

export async function RhythmWidget({ ym }: { ym: string }) {
  const d = await getRhythmWidget(ym);
  return (
    <>
      <Card>
        <Stack gap="sm">
          <CardLabel>Год на одной карте</CardLabel>
          <YearHeatmap heat={d.heat} />
          <Text fz="xs" c="dimmed">
            Каждая клетка — день; чем темнее, тем дороже. Колонки — недели.
          </Text>
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <CardLabel>Профиль недели · 6 мес</CardLabel>
          <WeekdayChart weekday={d.weekday} />
          <CardLabel>Ритуалы · стабильно каждый месяц</CardLabel>
          {d.regular.length === 0 ? (
            <Text fz="sm" c="dimmed">
              Стабильных ежемесячных трат пока не видно.
            </Text>
          ) : (
            <>
              <Stack gap={0}>
                {d.regular.map((r, i) => (
                  <Row
                    key={r.name}
                    last={i === d.regular.length - 1}
                    left={
                      <Text fz="sm" truncate>
                        {r.name}
                      </Text>
                    }
                    right={
                      <Text fz="sm" className="money" c="dimmed" style={{ flexShrink: 0 }}>
                        ~{money0(r.avg)}/мес
                      </Text>
                    }
                  />
                ))}
              </Stack>
              <Text fz="xs" c="dimmed">
                Вместе{' '}
                <Text span fz="xs" className="money">
                  ~{money0(d.regular.reduce((s, r) => s + r.avg, 0))}/мес
                </Text>{' '}
                ={' '}
                <Text span fz="xs" className="money">
                  {money0(d.regular.reduce((s, r) => s + r.avg, 0) * 12)}/год
                </Text>
                .
              </Text>
            </>
          )}
        </Stack>
      </Card>
    </>
  );
}

// ------------------------------------------------------------ инфляция

export async function InflationWidget({ ym }: { ym: string }) {
  const d = await getInflationWidget(ym);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Личная инфляция · средний чек</CardLabel>
        {d.categories.length === 0 ? (
          <Text fz="sm" c="dimmed">
            Пока мало операций, чтобы считать средние чеки.
          </Text>
        ) : (
          <InflationChart
            series={d.series}
            names={d.categories.map((c) => c.name)}
            changes={Object.fromEntries(d.categories.map((c) => [c.name, c.change]))}
          />
        )}
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ прогноз

export async function ForecastWidget({ ym }: { ym: string }) {
  const d = await getForecastWidget(ym);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Прогнозы и запас прочности</CardLabel>
        <Stack gap={0}>
          {d.yearSpendForecast !== null && (
            <Row
              left={<Text fz="sm">Расходов за год выйдет около</Text>}
              right={<Money value={Math.round(d.yearSpendForecast)} fz="sm" fw={600} style={{ flexShrink: 0 }} />}
            />
          )}
          {d.yearIncomeForecast !== null && (
            <Row
              left={<Text fz="sm">Доходов за год выйдет около</Text>}
              right={<Money value={Math.round(d.yearIncomeForecast)} fz="sm" fw={600} c="teal.8" style={{ flexShrink: 0 }} />}
            />
          )}
          {d.freeMonthly !== null && (
            <Row
              left={
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fz="sm">Свободно в месяц</Text>
                  <Text fz="xs" c="dimmed">
                    после трат и планов КАП{' '}
                    <Text span fz="xs" className="money">
                      {money0(d.planCap)}
                    </Text>{' '}
                    + КС{' '}
                    <Text span fz="xs" className="money">
                      {money0(d.planKs)}
                    </Text>
                  </Text>
                </Stack>
              }
              right={
                <Money
                  value={Math.round(d.freeMonthly)}
                  fz="sm"
                  fw={600}
                  c={d.freeMonthly >= 0 ? 'teal.8' : 'red.8'}
                  style={{ flexShrink: 0 }}
                />
              }
            />
          )}
          {d.runwayMonths !== null && (
            <Row
              last
              left={
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fz="sm">Запас прочности</Text>
                  <Text fz="xs" c="dimmed">
                    ликвидные{' '}
                    <Text span fz="xs" className="money">
                      {money0(d.liquid)}
                    </Text>{' '}
                    при{' '}
                    <Text span fz="xs" className="money">
                      {money0(d.avgSpend3)}/мес
                    </Text>
                  </Text>
                </Stack>
              }
              right={
                <Text fz="sm" fw={600} className="money" style={{ flexShrink: 0 }}>
                  ~{d.runwayMonths.toFixed(1).replace('.', ',')} мес
                </Text>
              }
            />
          )}
        </Stack>
        {d.yearSpendForecast === null && d.runwayMonths === null && (
          <Text fz="sm" c="dimmed">
            Для прогнозов нужна история хотя бы за пару месяцев.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

// ------------------------------------------- сбережения следующего месяца

export async function SavingsNextWidget() {
  const d = await getSavingsNext();
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Сбережения в {d.monthPrep}</CardLabel>
        <Stack gap={0}>
          <Row
            left={<Text fz="sm">КАП</Text>}
            right={<Money value={d.capMonthly} fz="sm" fw={600} exact style={{ flexShrink: 0 }} />}
          />
          <Row
            left={<Text fz="sm">КС</Text>}
            right={<Money value={d.ksMonthly} fz="sm" fw={600} exact style={{ flexShrink: 0 }} />}
          />
          <Row
            last
            left={<Text fz="sm">Долгосрочные сбережения</Text>}
            right={
              <Text fz="xs" c="dimmed" style={{ flexShrink: 0 }}>
                выберем на странице сбережений
              </Text>
            }
          />
        </Stack>
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ сравнения

export async function CompareWidget({ ym }: { ym: string }) {
  const d = await getCompareWidget(ym);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Год к году и характер месяца</CardLabel>
        {d.yoy ? (
          <Stack gap={0}>
            {d.yoy.map((g, i) => {
              const diff = g.lastYear > 0 ? ((g.current - g.lastYear) / g.lastYear) * 100 : null;
              return (
                <Row
                  key={g.name}
                  last={i === d.yoy!.length - 1}
                  left={
                    <Text fz="sm" truncate>
                      {g.name}
                    </Text>
                  }
                  right={
                    <Group gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                      <Text fz="xs" c="dimmed" className="money">
                        {money0(g.lastYear)} →
                      </Text>
                      <Text fz="sm" fw={500} className="money">
                        {money0(g.current)}
                      </Text>
                      {diff !== null && Math.abs(diff) >= 1 && (
                        <Text fz="xs" fw={600} className="money" c={diff > 0 ? 'red.7' : 'teal.8'}>
                          {diff > 0 ? '+' : ''}
                          {Math.round(diff)}%
                        </Text>
                      )}
                    </Group>
                  }
                />
              );
            })}
          </Stack>
        ) : (
          <Text fz="sm" c="dimmed">
            Год назад данных ещё не было — сравнение появится со временем.
          </Text>
        )}
        {d.bigShare !== null && (
          <Text fz="xs" c="dimmed">
            Характер месяца: {d.opsCount} операций, медианный чек{' '}
            <Text span fz="xs" className="money">
              {money0(d.medianOp ?? 0)}
            </Text>
            ; крупнейшие 10% операций сделали {d.bigShare}% суммы.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ гигиена

export async function HygieneWidget({ ym }: { ym: string }) {
  const d = await getHygieneWidget(ym);
  const pct = d.checkable > 0 ? Math.round((d.filled / d.checkable) * 100) : 0;
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Полнота учёта</CardLabel>
        <Stack gap={0}>
          <Row
            left={<Text fz="sm">Отмечено «день заполнен»</Text>}
            right={
              <Text fz="sm" fw={600} className="money" c={pct >= 80 ? 'teal.8' : pct >= 40 ? 'orange.8' : 'red.8'}>
                {d.filled} из {d.checkable} ({pct}%)
              </Text>
            }
          />
          <Row
            left={<Text fz="sm">Самая длинная серия дней без трат</Text>}
            right={
              <Text fz="sm" fw={600} className="money">
                {d.maxZeroStreak} дн.
              </Text>
            }
          />
          <Row
            last={d.staleAccounts.length === 0 && d.neverChecked === 0}
            left={<Text fz="sm">Счета без сверки 30+ дней</Text>}
            right={
              <Text fz="sm" fw={600} className="money">
                {d.staleAccounts.length + d.neverChecked}
              </Text>
            }
          />
          {d.staleAccounts.map((s, i) => (
            <Row
              key={s.name}
              last={i === d.staleAccounts.length - 1 && d.neverChecked === 0}
              left={
                <Text fz="xs" c="dimmed" pl={12} truncate>
                  {s.name}
                </Text>
              }
              right={
                <Text fz="xs" c="dimmed" className="money">
                  {s.days} дн. назад
                </Text>
              }
            />
          ))}
          {d.neverChecked > 0 && (
            <Row
              last
              left={
                <Text fz="xs" c="dimmed" pl={12}>
                  ни разу не сверялись
                </Text>
              }
              right={
                <Text fz="xs" c="dimmed" className="money">
                  {d.neverChecked}
                </Text>
              }
            />
          )}
        </Stack>
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ тренд 12 месяцев

export async function TrendWidget({ ym }: { ym: string }) {
  const months = await getTrendSeries(ym);
  return <TrendCard months={months} />;
}

// ------------------------------------------------------------ заполненность

export async function FillWidget() {
  const d = await getFillWidget();
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Заполненность учёта</CardLabel>
        {d.years.length === 0 ? (
          <Text fz="sm" c="dimmed">
            Данных пока нет.
          </Text>
        ) : (
          <>
            <FillYearsBrowser years={d.years} />
            <Group gap="md">
              <Group gap={6}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mantine-color-ink-4)' }} />
                <Text fz="xs" c="dimmed">день отмечен</Text>
              </Group>
              <Group gap={6}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mantine-color-orange-4)' }} />
                <Text fz="xs" c="dimmed">операции есть, отметки нет</Text>
              </Group>
              <Group gap={6}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mantine-color-gray-2)' }} />
                <Text fz="xs" c="dimmed">пусто</Text>
              </Group>
            </Group>
          </>
        )}
      </Stack>
    </Card>
  );
}

// ---------------------------------------------------------- КАП по месяцам

export async function CapMonthsWidget() {
  const d = await getCapMonths();
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>КАП по месяцам · флажки и переводы</CardLabel>
        {d.months.length === 0 ? (
          <Text fz="sm" c="dimmed">
            Взносов и переводов на КАП пока нет.
          </Text>
        ) : (
          <>
            {d.allOk ? (
              <Text fz="sm" c="teal.8">
                Во всех месяцах суммы флажков совпадают с переводами на счёт КАП ✓
              </Text>
            ) : (
              <Text fz="xs" c="dimmed">
                В каждом месяце сумма проставленных флажков должна совпадать с реальными переводами
                на счёт КАП:
              </Text>
            )}
            <Stack gap={0}>
              {d.months.map((m, i) => (
                <Row
                  key={m.ym}
                  last={i === d.months.length - 1}
                  left={
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text fz="sm" fw={500}>
                        {m.label}
                      </Text>
                      <Text fz="xs" c="dimmed" className="money">
                        флажки {moneyE(m.contribs)}{m.goals > 0 ? ` (${m.goals} целей)` : ''} · переводы {moneyE(m.transfers)}
                      </Text>
                    </Stack>
                  }
                  right={
                    Math.abs(m.diff) <= 0.005 ? (
                      <Text fz="sm" fw={600} c="teal.8" style={{ flexShrink: 0 }}>
                        ✓
                      </Text>
                    ) : (
                      <Text fz="sm" fw={600} className="money" c={m.diff > 0 ? 'orange.8' : 'red.8'} style={{ flexShrink: 0 }}>
                        {m.diff > 0 ? '+' : ''}
                        {moneyE(m.diff)}
                      </Text>
                    )
                  }
                />
              ))}
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
}

// -------------------------------------------------------------- аномалии

const ANOMALY_COLOR: Record<string, string> = {
  missing: 'orange.8',
  spike: 'red.8',
  quiet: 'blue.7',
  new: 'grape.7',
};

export async function AnomaliesWidget({ ym }: { ym: string }) {
  const items = await getAnomalies(ym);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Аномалии месяца</CardLabel>
        {items.length === 0 ? (
          <Text fz="sm" c="dimmed">
            Месяц похож на предыдущие: без пропаж, всплесков и новичков.
          </Text>
        ) : (
          <Stack gap={0}>
            {items.map((a, i) => (
              <Row
                key={a.title}
                last={i === items.length - 1}
                left={
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Text fz="sm" fw={600} c={ANOMALY_COLOR[a.kind]}>
                      {a.title}
                    </Text>
                    <Text fz="xs" c="dimmed">
                      {a.text}
                    </Text>
                  </Stack>
                }
                right={null}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------- месяц к месяцу

export async function MomWidget({ ym }: { ym: string }) {
  const tiles = await getMomTiles(ym);
  return (
    <SimpleGrid cols={{ base: 2, xs: 4, md: 8 }} spacing="xs">
      {tiles.map((t) => (
        <Card key={t.name} padding="xs">
          <Stack gap={2}>
            <Text fz="xs" c="dimmed" truncate>
              {t.name}
            </Text>
            <Group gap={6} justify="space-between" wrap="nowrap">
              <Text fz="sm" fw={600} className="money" truncate>
                {money0(t.current)}
              </Text>
              {t.pct !== null ? (
                <Text
                  fz="xs"
                  fw={700}
                  className="money"
                  c={t.pct > 0 ? 'red.7' : t.pct < 0 ? 'teal.8' : 'dimmed'}
                  style={{ flexShrink: 0 }}
                >
                  {t.pct > 0 ? '+' : ''}
                  {t.pct}%
                </Text>
              ) : (
                <Text fz="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  —
                </Text>
              )}
            </Group>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
