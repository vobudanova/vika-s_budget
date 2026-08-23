import { Stack } from '@mantine/core';
import { PageHeader } from '@/components/PageHeader';
import { SearchView } from '@/components/search/SearchView';

export const metadata = { title: 'Поиск' };

export default function SearchPage() {
  return (
    <Stack gap="md">
      <PageHeader title="Поиск" />
      <SearchView />
    </Stack>
  );
}
