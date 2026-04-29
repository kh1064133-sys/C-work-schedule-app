'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { CompletionRecord, CompletionRecordInput } from '@/types';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

// 완료 확인서 저장 (기존 기록이 있으면 업데이트, 없으면 새로 생성)
export function useSaveCompletionRecord() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CompletionRecordInput & { record_type?: string; payment_method?: string; memo?: string }) => {
      // 기존 기록 확인
      const { data: existing } = await supabase
        .from('completion_records')
        .select('id')
        .eq('schedule_id', input.schedule_id)
        .eq('record_type', input.record_type || 'completion')
        .limit(1)
        .maybeSingle();

      if (existing) {
        // 기존 기록 업데이트
        const { data, error } = await supabase
          .from('completion_records')
          .update({
            apartment_name: input.apartment_name,
            unit_number: input.unit_number,
            customer_name: input.customer_name,
            phone: input.phone,
            content: input.content,
            amount: input.amount,
            signature_data: input.signature_data,
            payment_method: input.payment_method,
            memo: input.memo,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data as CompletionRecord;
      } else {
        // 새 기록 생성
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
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['completion_records', variables.schedule_id] });
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

// 완료 기록 삭제 (스케줄 초기화 시)
export function useDeleteCompletionRecords() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const { error } = await supabase
        .from('completion_records')
        .delete()
        .eq('schedule_id', scheduleId);

      if (error) throw error;
    },
    onSuccess: (_, scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['completion_records', scheduleId] });
    },
  });
}

// 입금 상태 토글
export function useToggleSchedulePaid() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_paid }: { id: string; is_paid: boolean; date: string }) => {
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
