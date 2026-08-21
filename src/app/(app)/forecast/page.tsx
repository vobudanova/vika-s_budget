import {
  Card,
  SimpleGrid,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTr,
  Text,
} from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { Money } from '@/components/Money';
import { CardLabel } from '@/components/CardLabel';
import { getForecast } from '@/queries/forecast';
import { todayISO, ymAdd, ymOf, ymTitle } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function ForecastPage() {
  const nextYm = ymAdd(ymOf(todayISO()), 1);
  const f = await getForecast(nextYm);

  return (
    <Stack gap="md">
      <PageHeader
        title={`Прогноз · ${ymTitle(nextYm)}`}
        subtitle="Всё вычисляется из графиков и планов — вводить ничего не нужно"
      />
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        <Card>
          <Stack gap="sm">
            <CardLabel>КАП к отправке · по категориям</CardLabel>
            {f.capByCategory.length === 0 ? (
              <Text fz="sm" c="dimmed">
                Активных целей с остатком нет
              </Text>
            ) : (
              <Table verticalSpacing={4} fz="sm">
                <TableTbody>
                  {f.capByCategory.map((c) => (
                    <TableTr key={c.category}>
                      <TableTd px={0}>
                        <Text fz="sm">{c.category}</Text>
                        <Text fz="xs" c="dimmed" lineClamp={1}>
                          {c.goals.join(', ')}
                        </Text>
                      </TableTd>
                      <TableTd px={0} ta="right">
                        <Money value={c.amount} fz="sm" />
                      </TableTd>
                    </TableTr>
                  ))}
                  <TableTr>
                    <TableTd px={0}>
                      <Text fw={700} fz="sm">
                        Итого единым переводом
                      </Text>
                    </TableTd>
                    <TableTd px={0} ta="right">
                      <Money value={f.capTotal} fw={700} fz="sm" />
                    </TableTd>
                  </TableTr>
                </TableTbody>
              </Table>
            )}
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <CardLabel>Фонд КС · пополнение</CardLabel>
            <Table verticalSpacing={4} fz="sm">
              <TableTbody>
                <TableTr>
                  <TableTd px={0}>План по статьям</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={f.fundPlanTotal} fz="sm" />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>Зачтено компенсаций</TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={-f.fundOffsets} fz="sm" c={f.fundOffsets ? 'red.8' : undefined} />
                  </TableTd>
                </TableTr>
                <TableTr>
                  <TableTd px={0}>
                    <Text fw={700} fz="sm">
                      К переводу
                    </Text>
                  </TableTd>
                  <TableTd px={0} ta="right">
                    <Money value={f.fundToTransfer} fw={700} fz="sm" />
                  </TableTd>
                </TableTr>
              </TableTbody>
            </Table>
            <CardLabel>Амортизация месяца</CardLabel>
            <Money value={f.amortizationTotal} fz={24} fw={600} />
            <Text fz="xs" c="dimmed">
              начисления по графику, без ввода
            </Text>
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <CardLabel>Ожидаемые доходы</CardLabel>
            {f.expectedIncome.length === 0 ? (
              <Text fz="sm" c="dimmed">
                У источников не задана ожидаемая сумма — укажите её в настройках
              </Text>
            ) : (
              <Table verticalSpacing={4} fz="sm">
                <TableTbody>
                  {f.expectedIncome.map((i) => (
                    <TableTr key={i.name}>
                      <TableTd px={0}>{i.name}</TableTd>
                      <TableTd px={0} ta="right">
                        <Money value={i.amount} fz="sm" />
                      </TableTd>
                    </TableTr>
                  ))}
                  <TableTr>
                    <TableTd px={0}>
                      <Text fw={700} fz="sm">
                        Итого
                      </Text>
                    </TableTd>
                    <TableTd px={0} ta="right">
                      <Money value={f.expectedIncomeTotal} fw={700} fz="sm" c="ink.7" />
                    </TableTd>
                  </TableTr>
                </TableTbody>
              </Table>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}
