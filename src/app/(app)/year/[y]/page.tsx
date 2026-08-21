import { notFound } from 'next/navigation';
import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { YearView } from '@/components/year/YearView';
import { getYearData } from '@/queries/year';
import { fmtMoney } from '@/lib/money';
import { AnchorLink } from '@/components/links';
import { Group } from '@mantine/core';

export const dynamic = 'force-dynamic';

export default async function YearPage({ params }: { params: Promise<{ y: string }> }) {
  const { y } = await params;
  if (!/^\d{4}$/.test(y)) notFound();
  const data = await getYearData(y);

  return (
    <Stack gap="md">
      <PageHeader
        title={`Год ${y}`}
        subtitle={
          <>
            Доходы {fmtMoney(data.incomeYear)} · фактические {fmtMoney(data.actualYear)} ·
            начисленные {fmtMoney(data.accruedYear)}
          </>
        }
        right={
          <Group gap="xs">
            <AnchorLink href={`/year/${Number(y) - 1}`} fz="sm">
              ← {Number(y) - 1}
            </AnchorLink>
            <AnchorLink href={`/year/${Number(y) + 1}`} fz="sm">
              {Number(y) + 1} →
            </AnchorLink>
          </Group>
        }
      />
      <YearView data={data} />
    </Stack>
  );
}
