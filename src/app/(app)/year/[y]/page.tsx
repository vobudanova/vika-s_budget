import { notFound } from 'next/navigation';
import { Group, Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { YearView } from '@/components/year/YearView';
import { getYearSheet } from '@/queries/year';
import { AnchorLink } from '@/components/links';
import { WipeButton } from '@/components/WipeButton';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ y: string }> }) {
  const { y } = await params;
  return { title: `Год ${y}` };
}

export default async function YearPage({ params }: { params: Promise<{ y: string }> }) {
  const { y } = await params;
  if (!/^\d{4}$/.test(y)) notFound();
  const data = await getYearSheet(y);

  return (
    <Stack gap="md">
      <PageHeader
        title={`Год ${y}`}
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
      <YearView data={data} year={Number(y)} />
      <WipeButton scope={{ scope: 'year', year: y }} label={`все операции ${y} года`} />
    </Stack>
  );
}
