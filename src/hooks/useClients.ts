'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Client, ClientInput } from '@/types';

// 임시 user_id (인증 구현 전)
const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

// 모든 거래처 조회
export function useClients() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Client[];
    },
  });
}

// 거래처 검색
export function useSearchClients(query: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['clients', 'search', query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data as Client[];
    },
    enabled: query.length > 0,
  });
}

// 거래처 생성
export function useCreateClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClientInput) => {
      const { data, error } = await supabase
        .from('clients')
        .insert({
          ...input,
          user_id: TEMP_USER_ID,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// 거래처 수정
export function useUpdateClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ClientInput & { id: string }) => {
      const { data, error } = await supabase
        .from('clients')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

// 거래처 삭제
export function useDeleteClient() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
