import { NotFoundView } from '@/components/NotFoundView';

export const metadata = { title: 'Страница не найдена' };

/** 404 внутри оболочки — например, битый месяц в адресе. */
export default function NotFound() {
  return <NotFoundView />;
}
