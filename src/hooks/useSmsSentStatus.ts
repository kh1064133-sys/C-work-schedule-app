'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface SmsSentStatusDB {
  id: string;
  user_id: string;
  customer_id: string;
  sms_num: number;
  sent_at: string;
}

// 모든 고객의 발송 상태를 한번에 조회
export function useSmsSentStatusAll() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['sms_sent_status_all'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('sms_sent_status')
          .select('*')
          .eq('user_id', TEMP_USER_ID);

        if (error) throw error;
        return data as SmsSentStatusDB[];
      } catch {
        return [];
      }
    },
  });
}

// 특정 고객의 특정 문자번호가 발송되었는지 확인하는 헬퍼
export function isSent(statusList: SmsSentStatusDB[], customerId: string, smsNum: number): boolean {
  return statusList.some(s => s.customer_id === customerId && s.sms_num === smsNum);
}

export function useMarkSmsSent() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { customer_id: string; sms_num: number }) => {
      try {
        const { data, error } = await supabase
          .from('sms_sent_status')
          .upsert(
            {
              user_id: TEMP_USER_ID,
              customer_id: input.customer_id,
              sms_num: input.sms_num,
              sent_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,customer_id,sms_num' }
          )
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms_sent_status_all'] });
    },
  });
}
