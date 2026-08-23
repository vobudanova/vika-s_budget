import { redirect } from 'next/navigation';
import { todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function IncomeIndex() {
  redirect(`/income/${todayISO().slice(0, 4)}`);
}
