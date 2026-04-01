'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CompletionRecord, CompletionRecordInput } from '@/types';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

// 완료 확인서 저장
export function useSaveCompletionRecord() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompletionRecordInput & { record_type?: string; payment_method?: string; memo?: string }) => {
      const { data, error } = await supabase
        .from('completion_records')
        .insert({
          ...input,
          user_id: TEMP_USER_ID,
          record_type: input.record_type || 'completion',
        })
        .select()
        .single();

      if (error) throw error;
      return data as CompletionRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['completion_records'] });
    },
  });
}

// 특정 스케줄의 완료 확인 기록 조회
export function useCompletionRecords(scheduleId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['completion_records', scheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('completion_records')
        .select('*')
        .eq('schedule_id', scheduleId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CompletionRecord[];
    },
    enabled: !!scheduleId,
  });
}

// 입금 상태 토글
export function useToggleSchedulePaid() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_paid, date }: { id: string; is_paid: boolean; date: string }) => {
      const { data, error } = await supabase
        .from('schedules')
        .update({ is_paid })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['schedules', data.date] });
      queryClient.invalidateQueries({ queryKey: ['schedules', 'month'] });
    },
  });
}
