'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

export interface GroupBuyCustomerDB {
  id: string;
  user_id: string;
  install_date: string;
  day_of_week: string;
  time: string;
  dong: string;
  ho: string;
  contact: string;
  content: string;
  amount: number;
  payment_method: string;
  note: string;
  reserved: boolean;
  completed: boolean;
  deposited: boolean;
  sort_order: number;
}

export function useGroupBuyCustomers() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['groupbuy_customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groupbuy_customers')
        .select('*')
        .eq('user_id', TEMP_USER_ID)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return data as GroupBuyCustomerDB[];
    },
  });
}

export function useUpsertGroupBuyCustomer() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<GroupBuyCustomerDB, 'user_id'>) => {
      const { data, error } = await supabase
        .from('groupbuy_customers')
        .upsert({
          ...input,
          user_id: TEMP_USER_ID,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GroupBuyCustomerDB;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupbuy_customers'] });
    },
  });
}

export function useBatchUpsertGroupBuy() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inputs: Omit<GroupBuyCustomerDB, 'user_id'>[]) => {
      const rows = inputs.map(input => ({
        ...input,
        user_id: TEMP_USER_ID,
      }));
      const { error } = await supabase
        .from('groupbuy_customers')
        .upsert(rows);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupbuy_customers'] });
    },
  });
}

export function useDeleteGroupBuyCustomer() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('groupbuy_customers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupbuy_customers'] });
    },
  });
}
