'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface SupplierCompany {
  id?: string;
  user_id?: string;
  company_index: number;
  name: string;
  ceo: string;
  biz_no: string;
  address: string;
  tel: string;
  email: string;
  is_active: boolean;
}

// 공급자 목록 조회
export function useSupplierCompanies() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['supplier_companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('supplier_companies')
        .select('*')
        .eq('user_id', TEMP_USER_ID)
        .order('company_index', { ascending: true });

      if (error) throw error;
      return data as SupplierCompany[];
    },
  });
}

// 공급자 upsert (자동 저장)
export function useUpsertSupplier() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<SupplierCompany, 'id' | 'user_id'>) => {
      const { data, error } = await supabase
        .from('supplier_companies')
        .upsert({
          ...input,
          user_id: TEMP_USER_ID,
        }, { onConflict: 'user_id,company_index' })
        .select()
        .single();

      if (error) throw error;
      return data as SupplierCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_companies'] });
    },
  });
}

// 공급자 삭제
export function useDeleteSupplier() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (companyIndex: number) => {
      const { error } = await supabase
        .from('supplier_companies')
        .delete()
        .eq('user_id', TEMP_USER_ID)
        .eq('company_index', companyIndex);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier_companies'] });
    },
  });
}
