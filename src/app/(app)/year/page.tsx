import { redirect } from 'next/navigation';
import { todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function YearIndex() {
  redirect(`/year/${todayISO().slice(0, 4)}`);
}
