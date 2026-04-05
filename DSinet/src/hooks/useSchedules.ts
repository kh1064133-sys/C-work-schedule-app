'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';
import type { Schedule, ScheduleInput } from '@/types';
import { formatDate } from '@/lib/utils/date';

const KEY = 'schedules';

function getAll(): Schedule[] {
  return getStoredItems<Schedule>(KEY);
}
function saveAll(items: Schedule[]) {
  setStoredItems(KEY, items);
}

export function useSchedulesByDate(date: Date) {
  const dateStr = formatDate(date);
  return useQuery({
    queryKey: ['schedules', dateStr],
    queryFn: () => getAll()
      .filter(s => s.date === dateStr)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  });
}

export function useSchedulesByMonth(year: number, month: number) {
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return useQuery({
    queryKey: ['schedules', 'month', year, month],
    queryFn: () => getAll()
      .filter(s => s.date >= startDate && s.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.sort_order || 0) - (b.sort_order || 0)),
  });
}

export function useAllPendingSchedules(beforeDate: string) {
  return useQuery({
    queryKey: ['schedules', 'allPending', beforeDate],
    queryFn: () => {
      const all = getAll();
      const undone = all.filter(s => !s.is_done && s.title && s.title.trim() !== '' && s.date < beforeDate);
      const doneUnpaid = all.filter(s => s.is_done && !s.is_paid && s.title && s.title.trim() !== '');
      const merged = [...undone, ...doneUnpaid];
      const seen = new Set<string>();
      return merged
        .filter(s => { if (seen.has(s.id)) return false; seen.add(s.id); return true; })
        .sort((a, b) => a.date.localeCompare(b.date) || a.time_slot.localeCompare(b.time_slot));
    },
  });
}

export function useSchedulesByYear(year: number) {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;
  return useQuery({
    queryKey: ['schedules', 'year', year],
    queryFn: () => getAll()
      .filter(s => s.date >= startDate && s.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date)),
  });
}

export function useUpsertSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ScheduleInput & { id?: string }) => {
      const all = getAll();
      const cleanedInput = Object.fromEntries(
        Object.entries(input).filter(([, v]) => v !== undefined)
      );
      // Find existing by id or by (date, time_slot)
      let existing = input.id
        ? all.find(s => s.id === input.id)
        : all.find(s => s.date === input.date && s.time_slot === input.time_slot);

      if (existing) {
        Object.assign(existing, cleanedInput, { updated_at: new Date().toISOString() });
        saveAll(all);
        return existing;
      } else {
        const newItem: Schedule = {
          id: crypto.randomUUID(),
          user_id: 'local',
          date: input.date,
          time_slot: input.time_slot,
          title: null,
          unit: null,
          memo: null,
          schedule_type: null,
          amount: 0,
          payment_method: null,
          is_done: false,
          is_reserved: false,
          is_paid: false,
          event_icon: null,
          sort_order: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...cleanedInput,
        };
        all.push(newItem);
        saveAll(all);
        return newItem;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const all = getAll().filter(s => s.id !== id);
      saveAll(all);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useMoveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, time_slot, date }: { id: string; time_slot: string; date: string }) => {
      const all = getAll();
      const target = all.find(s => s.id === id);
      if (!target) throw new Error('Not found');
      target.time_slot = time_slot;
      target.updated_at = new Date().toISOString();
      saveAll(all);
      return { ...target, date };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', data.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
    },
  });
}

export function useToggleScheduleDone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const all = getAll();
      const target = all.find(s => s.id === id);
      if (!target) throw new Error('Not found');
      target.is_done = is_done;
      if (is_done) target.is_reserved = false;
      target.updated_at = new Date().toISOString();
      saveAll(all);
      return target;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useToggleScheduleReserved() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_reserved }: { id: string; is_reserved: boolean }) => {
      const all = getAll();
      const target = all.find(s => s.id === id);
      if (!target) throw new Error('Not found');
      target.is_reserved = is_reserved;
      target.updated_at = new Date().toISOString();
      saveAll(all);
      return target;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useSwapSchedules() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ schedule1, schedule2 }: { schedule1: Schedule; schedule2: Schedule; date: string }) => {
      const all = getAll();
      const s1 = all.find(s => s.id === schedule1.id);
      const s2 = all.find(s => s.id === schedule2.id);
      if (!s1 || !s2) throw new Error('Not found');
      const tmpSlot = s1.time_slot;
      const tmpOrder = s1.sort_order;
      s1.time_slot = s2.time_slot;
      s1.sort_order = s2.sort_order;
      s2.time_slot = tmpSlot;
      s2.sort_order = tmpOrder;
      s1.updated_at = new Date().toISOString();
      s2.updated_at = new Date().toISOString();
      saveAll(all);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
}

export function useSearchSchedules(params: { query?: string; fromDate?: string; toDate?: string; scheduleType?: string }) {
  return useQuery({
    queryKey: ['schedules', 'search', params],
    queryFn: () => {
      let results = getAll();
      if (params.fromDate) results = results.filter(s => s.date >= params.fromDate!);
      if (params.toDate) results = results.filter(s => s.date <= params.toDate!);
      if (params.scheduleType) results = results.filter(s => s.schedule_type === params.scheduleType);
      if (params.query) {
        const q = params.query.toLowerCase();
        results = results.filter(s =>
          (s.title && s.title.toLowerCase().includes(q)) ||
          (s.unit && s.unit.toLowerCase().includes(q)) ||
          (s.memo && s.memo.toLowerCase().includes(q))
        );
      }
      return results.sort((a, b) => b.date.localeCompare(a.date) || a.time_slot.localeCompare(b.time_slot));
    },
  });
}
