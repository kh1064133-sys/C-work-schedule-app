'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Schedule, ScheduleInput } from '@/types';
import { formatDate } from '@/lib/utils/date';

// 임시 user_id (인증 구현 전)
const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

// 특정 날짜의 스케줄 조회
export function useSchedulesByDate(date: Date) {
  const supabase = createClient();
  const dateStr = formatDate(date);

  return useQuery({
    queryKey: ['schedules', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('date', dateStr)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Schedule[];
    },
  });
}

// 월별 스케줄 조회 (달력용)
export function useSchedulesByMonth(year: number, month: number) {
  const supabase = createClient();
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  // 해당 월의 실제 마지막 날 계산 (다음 달 0일 = 이번 달 마지막 날)
  const lastDay = new Date(year, month + 1, 0).getDate();
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return useQuery({
    queryKey: ['schedules', 'month', year, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as Schedule[];
    },
  });
}

// 오늘 이전의 모든 미완료 스케줄 조회 (이전 미결용)
export function useAllPendingSchedules(beforeDate: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['schedules', 'allPending', beforeDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('is_done', false)
        .neq('title', '')
        .lt('date', beforeDate)
        .order('date', { ascending: true })
        .order('time_slot', { ascending: true });

      if (error) throw error;
      // title이 null인 경우도 제외
      return (data as Schedule[]).filter(s => s.title && s.title.trim() !== '');
    },
  });
}

// 연간 스케줄 조회
export function useSchedulesByYear(year: number) {
  const supabase = createClient();
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  return useQuery({
    queryKey: ['schedules', 'year', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;
      return data as Schedule[];
    },
  });
}

// 스케줄 생성/수정 (upsert)
export function useUpsertSchedule() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ScheduleInput & { id?: string }) => {
      // undefined 필드 제거 (null은 유지하여 DB에 null로 저장)
      const cleanedInput = Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined)
      );
      
      const { data, error } = await supabase
        .from('schedules')
        .upsert({
          ...cleanedInput,
          user_id: TEMP_USER_ID,
        }, { onConflict: 'user_id,date,time_slot' })
        .select()
        .single();

      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      // 해당 날짜 캐시 무효화
      queryClient.invalidateQueries({ queryKey: ['schedules', data.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'allPending'] });
    },
  });
}

// 스케줄 삭제
export function useDeleteSchedule() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) => {
      const { error } = await supabase
        .from('schedules')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, date };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', variables.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
    },
  });
}

// 완료 상태 토글
export function useToggleScheduleDone() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_done, date }: { id: string; is_done: boolean; date: string }) => {
      const { data, error } = await supabase
        .from('schedules')
        .update({ is_done })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', data.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
    },
  });
}

// 예약 상태 토글
export function useToggleScheduleReserved() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_reserved, date }: { id: string; is_reserved: boolean; date: string }) => {
      const { data, error } = await supabase
        .from('schedules')
        .update({ is_reserved })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Schedule;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', data.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
    },
  });
}

// 스케줄 검색
export function useSearchSchedules(params: {
  query?: string;
  fromDate?: string;
  toDate?: string;
  type?: string;
}) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['schedules', 'search', params],
    queryFn: async () => {
      let query = supabase.from('schedules').select('*');

      if (params.fromDate) {
        query = query.gte('date', params.fromDate);
      }
      if (params.toDate) {
        query = query.lte('date', params.toDate);
      }
      if (params.type) {
        query = query.eq('schedule_type', params.type);
      }
      if (params.query) {
        query = query.or(
          `title.ilike.%${params.query}%,unit.ilike.%${params.query}%,memo.ilike.%${params.query}%`
        );
      }

      const { data, error } = await query.order('date', { ascending: false }).order('time_slot');

      if (error) throw error;
      return data as Schedule[];
    },
    enabled: Boolean(params.query || params.fromDate || params.toDate || params.type),
  });
}

// 스케줄 순서 스왑
export function useSwapSchedules() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      schedule1, 
      schedule2, 
      date 
    }: { 
      schedule1: Schedule | null; 
      schedule2: Schedule | null; 
      date: string;
    }) => {
      if (schedule1 && schedule2) {
        // 둘 다 있으면 데이터 스왑
        await supabase.from('schedules').update({
          title: schedule2.title,
          unit: schedule2.unit,
          memo: schedule2.memo,
          schedule_type: schedule2.schedule_type,
          amount: schedule2.amount,
          payment_method: schedule2.payment_method,
          is_done: schedule2.is_done,
          is_reserved: schedule2.is_reserved,
        }).eq('id', schedule1.id);
        
        await supabase.from('schedules').update({
          title: schedule1.title,
          unit: schedule1.unit,
          memo: schedule1.memo,
          schedule_type: schedule1.schedule_type,
          amount: schedule1.amount,
          payment_method: schedule1.payment_method,
          is_done: schedule1.is_done,
          is_reserved: schedule1.is_reserved,
        }).eq('id', schedule2.id);
      }

      return { date };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', variables.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
    },
  });
}

