import { Badge, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { CardLabel } from '@/components/CardLabel';
import { Money } from '@/components/Money';
import {
  getCompareWidget,
  getForecastWidget,
  getFundsWidget,
  getHygieneWidget,
  getInflationWidget,
  getRhythmWidget,
  getAmortCheckWidget,
  getCapCheckWidget,
  getFillWidget,
  getThingsWidget,
  getTrendSeries,
} from '@/queries/analytics-widgets';
import { CapexChart, FillHeatmap, InflationChart, WeekdayChart, YearHeatmap } from './widget-charts';
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
    <>
      <Card>
        <Stack gap="sm">
          <CardLabel>Стоимость владения вещами</CardLabel>
          {d.activeCount === 0 ? (
            <Text fz="sm" c="dimmed">
              Активных покупок нет.
            </Text>
          ) : (
            <>
              <Group gap="xs" align="baseline">
                <Money value={Math.round(d.perDay)} fz={22} fw={700} />
                <Text fz="sm" c="dimmed">
                  в день · {d.activeCount} вещей
                </Text>
              </Group>
              <Stack gap={0}>
                {d.top.map((t, i) => (
                  <Row
                    key={t.name}
                    last={i === d.top.length - 1}
                    left={
                      <Text fz="sm" truncate>
                        {t.name}
                      </Text>
                    }
                    right={
                      <Text fz="sm" className="money" c="dimmed" style={{ flexShrink: 0 }}>
                        {money0(t.monthly)}/мес
                      </Text>
                    }
                  />
                ))}
              </Stack>
            </>
          )}
        </Stack>
      </Card>
      <Card>
        <Stack gap="sm">
          <CardLabel>Когда станет легче</CardLabel>
          {d.releases.length === 0 ? (
            <Text fz="sm" c="dimmed">
              В ближайшие месяцы начисления не заканчиваются.
            </Text>
          ) : (
            <Stack gap={0}>
              {d.releases.map((r, i) => (
                <Row
                  key={r.label}
                  last={i === d.releases.length - 1}
                  left={<Text fz="sm">{r.label} — доамортизируются вещи</Text>}
                  right={
                    <Text fz="sm" className="money" c="teal.8" fw={500} style={{ flexShrink: 0 }}>
                      −{money0(r.monthly)}/мес
                    </Text>
                  }
                />
              ))}
            </Stack>
          )}
          <CardLabel>Доля покупок в расходах</CardLabel>
          <CapexChart data={d.capexShare} />
        </Stack>
      </Card>
    </>
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
  const noData = d.series.every((s) => s.Продукты === null && s.Кафе === null);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Личная инфляция · средний чек</CardLabel>
        {noData ? (
          <Text fz="sm" c="dimmed">
            Недостаточно данных по продуктам и кафе.
          </Text>
        ) : (
          <>
            <InflationChart series={d.series} />
            <Group gap="lg">
              {d.groceryChange !== null && (
                <Text fz="xs" c="dimmed">
                  Продукты:{' '}
                  <Text span fw={600} c={d.groceryChange > 0 ? 'red.7' : 'teal.8'}>
                    {d.groceryChange > 0 ? '+' : ''}
                    {d.groceryChange}%
                  </Text>{' '}
                  за период
                </Text>
              )}
              {d.cafeChange !== null && (
                <Text fz="xs" c="dimmed">
                  Кафе:{' '}
                  <Text span fw={600} c={d.cafeChange > 0 ? 'red.7' : 'teal.8'}>
                    {d.cafeChange > 0 ? '+' : ''}
                    {d.cafeChange}%
                  </Text>{' '}
                  за период
                </Text>
              )}
            </Group>
          </>
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

// ------------------------------------------------------------ фонды

export async function FundsWidget({ ym }: { ym: string }) {
  const d = await getFundsWidget(ym);
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Здоровье фондов</CardLabel>
        <Group gap="xs">
          <Badge variant="light" color="teal">
            КАП в графике: {d.capOnTrack}
          </Badge>
          {d.capBehind > 0 && (
            <Badge variant="light" color="orange">
              отстают: {d.capBehind} на {money0(d.capBehindSum)}
            </Badge>
          )}
          {d.capDoneBy && (
            <Badge variant="light" color="gray">
              все цели закроются к {d.capDoneBy}
            </Badge>
          )}
        </Group>
        {d.ksBurn.length > 0 ? (
          <>
            <Text fz="xs" c="dimmed">
              Статьи КС, которые тают быстрее всего (темп — среднее за 3 мес):
            </Text>
            <Stack gap={0}>
              {d.ksBurn.map((k, i) => (
                <Row
                  key={k.name}
                  last={i === d.ksBurn.length - 1}
                  left={
                    <Text fz="sm" truncate>
                      {k.name}{' '}
                      <Text span fz="xs" c="dimmed" className="money">
                        {money0(k.balance)} при {money0(k.perMonth)}/мес
                      </Text>
                    </Text>
                  }
                  right={
                    <Text
                      fz="sm"
                      fw={600}
                      className="money"
                      c={k.monthsLeft < 2 ? 'red.8' : k.monthsLeft < 4 ? 'orange.8' : undefined}
                      style={{ flexShrink: 0 }}
                    >
                      {k.monthsLeft < 0.05 ? '<0,1' : `~${k.monthsLeft.toFixed(1).replace('.', ',')}`} мес
                    </Text>
                  }
                />
              ))}
            </Stack>
          </>
        ) : (
          <Text fz="sm" c="dimmed">
            Активных трат из статей КС за последние месяцы нет — сальдо не тают.
          </Text>
        )}
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

const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

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
            {d.years.map((y) => (
              <Stack key={y.year} gap={6}>
                <Group gap="xs" align="baseline">
                  <Text fw={700} fz="sm" className="money">
                    {y.year}
                  </Text>
                  <Text
                    fz="xs"
                    className="money"
                    c={y.filled / Math.max(y.passed, 1) >= 0.8 ? 'teal.8' : y.filled / Math.max(y.passed, 1) >= 0.4 ? 'orange.8' : 'red.8'}
                  >
                    отмечено {y.filled} из {y.passed} ({Math.round((y.filled / Math.max(y.passed, 1)) * 100)}%)
                  </Text>
                </Group>
                <FillHeatmap year={y.year} days={y.days} />
              </Stack>
            ))}
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
            {d.gaps.length > 0 && (
              <>
                <CardLabel>Самые большие дырки</CardLabel>
                <Stack gap={0}>
                  {d.gaps.map((g, i) => (
                    <Row
                      key={g.from}
                      last={i === d.gaps.length - 1}
                      left={
                        <Text fz="sm" className="money">
                          {dm(g.from)} — {dm(g.to)}
                        </Text>
                      }
                      right={
                        <Text fz="sm" fw={600} className="money" c={g.days >= 14 ? 'red.8' : 'orange.8'} style={{ flexShrink: 0 }}>
                          {g.days} дн. подряд
                        </Text>
                      }
                    />
                  ))}
                </Stack>
              </>
            )}
          </>
        )}
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------------ сверка КАП

export async function CapCheckWidget() {
  const d = await getCapCheckWidget();
  const ok = d.mismatches.length === 0;
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Сверка КАП · переводы и взносы</CardLabel>
        {ok ? (
          <Text fz="sm" c="teal.8">
            Переводы на счёт КАП совпадают со взносами до копейки во всех месяцах ({d.monthsChecked}) ✓
          </Text>
        ) : (
          <>
            <Text fz="xs" c="dimmed">
              Месяцы, где сумма переводов на счёт КАП не сошлась с проставленными взносами:
            </Text>
            <Stack gap={0}>
              {d.mismatches.map((m, i) => (
                <Row
                  key={m.ym}
                  last={i === d.mismatches.length - 1}
                  left={
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text fz="sm" fw={500}>
                        {m.label}
                      </Text>
                      <Text fz="xs" c="dimmed" className="money">
                        переводы {moneyE(m.transfers)} · взносы {moneyE(m.contribs)}
                      </Text>
                    </Stack>
                  }
                  right={
                    <Text fz="sm" fw={600} className="money" c={m.diff > 0 ? 'orange.8' : 'red.8'} style={{ flexShrink: 0 }}>
                      {m.diff > 0 ? '+' : ''}
                      {moneyE(m.diff)}
                    </Text>
                  }
                />
              ))}
            </Stack>
          </>
        )}
        <Text fz="xs" c="dimmed" className="money">
          Всего переводов {moneyE(d.totalTransfers)} · взносов {moneyE(d.totalContribs)}
          {Math.abs(d.totalDiff) > 0.005 ? ` · разница ${d.totalDiff > 0 ? '+' : ''}${moneyE(d.totalDiff)}` : ' · сходится ✓'}
        </Text>
      </Stack>
    </Card>
  );
}

// ------------------------------------------------------ сверка амортизации

export async function AmortCheckWidget() {
  const d = await getAmortCheckWidget();
  return (
    <Card>
      <Stack gap="sm">
        <CardLabel>Сверка амортизации</CardLabel>
        {d.broken.length === 0 ? (
          <Text fz="sm" c="teal.8">
            Графики начислений всех вещей ({d.totalAssets}) сходятся с ценами до копейки ✓
          </Text>
        ) : (
          <>
            <Text fz="xs" c="dimmed">
              Вещи, у которых график начислений бьётся с ценой или сроком:
            </Text>
            <Stack gap={0}>
              {d.broken.map((b, i) => (
                <Row
                  key={b.name}
                  last={i === d.broken.length - 1}
                  left={
                    <Stack gap={2} style={{ minWidth: 0 }}>
                      <Text fz="sm" fw={500} truncate>
                        {b.name}
                      </Text>
                      <Text fz="xs" c="dimmed" className="money">
                        график {moneyE(b.scheduled)} · цена {moneyE(b.price)}
                        {b.countDiff !== 0 ? ` · платежей ${b.countDiff > 0 ? '+' : ''}${b.countDiff}` : ''}
                      </Text>
                    </Stack>
                  }
                  right={
                    <Text fz="sm" fw={600} className="money" c="red.8" style={{ flexShrink: 0 }}>
                      {b.diff > 0 ? '+' : ''}
                      {moneyE(b.diff)}
                    </Text>
                  }
                />
              ))}
            </Stack>
            <Text fz="xs" c="dimmed">
              Остальные {d.okCount} из {d.totalAssets} сходятся. Пересоздать график можно через
              «Редактировать…» на странице Амортизации.
            </Text>
          </>
        )}
      </Stack>
    </Card>
  );
}
