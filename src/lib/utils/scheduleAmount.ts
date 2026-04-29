import type { Schedule } from '@/types';

export function getScheduleAmountWithTax(schedule: Pick<Schedule, 'amount' | 'payment_method'>): number {
  const amount = schedule.amount || 0;
  return schedule.payment_method === 'card' || schedule.payment_method === 'vat'
    ? Math.round(amount * 1.1)
    : amount;
}
