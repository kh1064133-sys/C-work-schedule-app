'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';
const SHARED_CUSTOMER_ID = '00000000-0000-0000-0000-000000000000'; // 전체 공통 템플릿용
const LOCAL_STORAGE_KEY = 'groupbuy_sms_templates_v2';

export interface SmsTemplateDB {
  id: string;
  user_id: string;
  customer_id: string;
  sms_num: number;
  template_text: string;
  created_at: string;
  updated_at: string;
}

// localStorage fallback helpers
function loadLocal(): Record<string, string> {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch { return {}; }
}

function saveLocal(smsNum: number, text: string) {
  const all = loadLocal();
  all[`shared_${smsNum}`] = text;
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(all));
}

function localToTemplates(): SmsTemplateDB[] {
  const all = loadLocal();
  const results: SmsTemplateDB[] = [];
  for (let n = 1; n <= 4; n++) {
    const key = `shared_${n}`;
    if (all[key]) {
      results.push({
        id: key,
        user_id: TEMP_USER_ID,
        customer_id: SHARED_CUSTOMER_ID,
        sms_num: n,
        template_text: all[key],
        created_at: '',
        updated_at: '',
      });
    }
  }
  return results;
}

// 문자 번호별 공통 템플릿 조회 (모든 고객 공유)
export function useSmsTemplates() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['sms_templates_shared'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('sms_templates')
          .select('*')
          .eq('user_id', TEMP_USER_ID)
          .eq('customer_id', SHARED_CUSTOMER_ID);

        if (error) throw error;
        return data as SmsTemplateDB[];
      } catch {
        return localToTemplates();
      }
    },
  });
}

export function useUpsertSmsTemplate() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { sms_num: number; template_text: string }) => {
      saveLocal(input.sms_num, input.template_text);

      try {
        const { data, error } = await supabase
          .from('sms_templates')
          .upsert(
            {
              user_id: TEMP_USER_ID,
              customer_id: SHARED_CUSTOMER_ID,
              sms_num: input.sms_num,
              template_text: input.template_text,
              updated_at: new Date().toISOString(),
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
      queryClient.invalidateQueries({ queryKey: ['sms_templates_shared'] });
    },
  });
}
