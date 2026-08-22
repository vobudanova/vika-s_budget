import {
  Badge,
  Card,
  Group,
  ScrollArea,
  Stack,
  Table,
  TableTbody,
  TableTd,
  TableTh,
  TableThead,
  TableTr,
  Text,
} from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { Money } from '@/components/Money';
import { getAssetsOverview, type AssetOverview } from '@/queries/assets';
import { getReference, getSetting } from '@/queries/core';
import { AssetActions, NewPurchaseButton } from '@/components/assets/AssetActions';
import { fmtMoney } from '@/lib/money';
import { dateShort } from '@/lib/dates';
import { WipeButton } from '@/components/WipeButton';

export const metadata = { title: 'Амортизация' };

export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const [assets, ref, inflationRate] = await Promise.all([
    getAssetsOverview(),
    getReference(),
    getSetting<number>('cap_inflation_rate', 1.1),
  ]);

  const isFinished = (a: AssetOverview) => a.future === 0;
  const active = assets.filter((a) => !isFinished(a));
  const finished = assets.filter(isFinished);
  const categories = [...new Set(active.map((a) => a.categoryName))];
  const moneyAccounts = ref.accounts
    .filter((a) => ['checking', 'credit_card', 'cash'].includes(a.type))
    .map((a) => ({ id: a.id, name: a.name }));
  const monthlyTotal = active.reduce((s, a) => s + a.monthlyAmount, 0);

  return (
    <Stack gap="md">
      <PageHeader
        title="Амортизация"
        subtitle={
          <>
            {active.length} активных покупок · начисляется {fmtMoney(monthlyTotal)}/мес
          </>
        }
        right={
          <NewPurchaseButton
            assetCategories={ref.assetCategories.map((c) => ({ id: c.id, name: c.name }))}
            accounts={moneyAccounts}
            defaultAccountId={ref.accounts.find((a) => a.type === 'checking')?.id ?? null}
            inflationRate={inflationRate}
          />
        }
      />

      {assets.length === 0 && (
        <Card>
          <Text c="dimmed">Покупок пока нет.</Text>
        </Card>
      )}

      {categories.map((cat) => (
        <Card key={cat} p={0}>
          <Group px="md" py="sm" justify="space-between">
            <Text fw={600}>{cat}</Text>
            <Money
              value={active.filter((a) => a.categoryName === cat).reduce((s, a) => s + a.monthlyAmount, 0)}
              fz="sm"
              c="dimmed"
            />
          </Group>
          <AssetTable rows={active.filter((a) => a.categoryName === cat)} accounts={moneyAccounts} />
        </Card>
      ))}

      {finished.length > 0 && (
        <Card p={0}>
          <Group px="md" py="sm">
            <Text fw={600} c="dimmed">
              Завершено
            </Text>
            <Badge variant="light" color="gray">
              {finished.length}
            </Badge>
          </Group>
          <AssetTable rows={finished} accounts={moneyAccounts} finished />
        </Card>
      )}
      <WipeButton scope={{ scope: 'assets' }} label="все покупки, графики амортизации и их КАП" />
    </Stack>
  );
}

function AssetTable({
  rows,
  accounts,
  finished = false,
}: {
  rows: AssetOverview[];
  accounts: { id: number; name: string }[];
  finished?: boolean;
}) {
  return (
    <ScrollArea type="auto" offsetScrollbars>
      <Table miw={820} verticalSpacing={9} horizontalSpacing={12} fz="sm">
        <TableThead>
          <TableTr>
            <TableTh ta="center">Покупка</TableTh>
            <TableTh ta="center">Дата</TableTh>
            <TableTh ta="center">Цена</TableTh>
            <TableTh ta="center">Срок</TableTh>
            <TableTh ta="center">₽/мес</TableTh>
            <TableTh ta="center">пред · тек · след</TableTh>
            <TableTh ta="center">КАП</TableTh>
            <TableTh w={40}></TableTh>
          </TableTr>
        </TableThead>
        <TableTbody>
          {rows.map((a) => (
            <TableTr key={a.id} opacity={finished ? 0.7 : 1}>
              <TableTd maw={240}>
                <Text fz="sm" fw={500} truncate>
                  {a.name}
                </Text>
                {a.disposedAt && (
                  <Text fz="xs" c="orange.8">
                    завершено {dateShort(a.disposedAt)}
                  </Text>
                )}
              </TableTd>
              <TableTd className="money">{dateShort(a.purchaseDate)}</TableTd>
              <TableTd ta="right">
                <Money value={a.effectivePrice} fz="sm" />
                {a.effectivePrice !== a.initialPrice && (
                  <Text fz="xs" c="dimmed" className="money">
                    была {fmtMoney(a.initialPrice)}
                  </Text>
                )}
              </TableTd>
              <TableTd ta="right" className="money">
                {a.termMonths} мес
              </TableTd>
              <TableTd ta="right">
                <Money value={a.monthlyAmount} fz="sm" />
              </TableTd>
              <TableTd ta="right" className="money">
                {a.prevYears} · {a.currentYear} ·{' '}
                {a.future <= 2 && a.future > 0 && !finished ? (
                  <Badge size="sm" variant="light" color="orange" component="span">
                    {a.future}
                  </Badge>
                ) : (
                  a.future
                )}
              </TableTd>
              <TableTd>
                <CapCell a={a} />
              </TableTd>
              <TableTd>
                <AssetActions
                  assetId={a.id}
                  name={a.name}
                  disposed={!!a.disposedAt}
                  hasCap={!!a.goalId && !a.goalSpentAt}
                  accounts={accounts}
                />
              </TableTd>
            </TableTr>
          ))}
        </TableTbody>
      </Table>
    </ScrollArea>
  );
}

function CapCell({ a }: { a: AssetOverview }) {
  if (!a.goalId) {
    return (
      <Badge variant="light" color="gray" size="sm">
        не применимо
      </Badge>
    );
  }
  if (a.goalSpentAt) {
    return (
      <Badge variant="light" color="ink" size="sm">
        потрачено
      </Badge>
    );
  }
  const pct =
    a.goalTarget && a.goalTarget > 0
      ? Math.min(100, Math.round(((a.goalContributed ?? 0) / a.goalTarget) * 100))
      : 0;
  return (
    <Text fz="xs" className="money" c="dimmed">
      {pct}% из {fmtMoney(a.goalTarget ?? 0)}
    </Text>
  );
}
