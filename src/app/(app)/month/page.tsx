import { redirect } from 'next/navigation';
import { todayISO, ymOf } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function MonthIndex() {
  redirect(`/month/${ymOf(todayISO())}`);
}
