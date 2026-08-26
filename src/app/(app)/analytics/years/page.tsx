import { redirect } from 'next/navigation';
import { todayISO } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function AnalyticsYearsIndex() {
  redirect(`/analytics/years/${todayISO().slice(0, 4)}`);
}
