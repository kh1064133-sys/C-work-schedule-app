'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Item, ItemInput } from '@/types';

// 임시 user_id (인증 구현 전)
const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

// 모든 품목 조회
export function useItems() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Item[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

// 품목 생성
export function useCreateItem() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ItemInput) => {
      const { data, error } = await supabase
        .from('items')
        .insert({
          ...input,
          user_id: TEMP_USER_ID,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// 품목 수정
export function useUpdateItem() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: ItemInput & { id: string }) => {
      const { data, error } = await supabase
        .from('items')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// 품목 삭제
export function useDeleteItem() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// 품목 순서 저장
export function useUpdateItemSortOrder() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: Array<{ id: string; sort_order: number }>) => {
      const updates = items.map(({ id, sort_order }) =>
        supabase
          .from('items')
          .update({ sort_order })
          .eq('id', id)
          .select('id, sort_order')
          .single(),
      );

      const results = await Promise.all(updates);
      const errorResult = results.find((result) => result.error);
      if (errorResult?.error) throw errorResult.error;

      return results.map((result) => result.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// 제품 매뉴얼 업로드 (Supabase Storage)
export function useUploadItemManual() {
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ file, itemId, kind = 'manual' }: { file: File; itemId: string; kind?: 'manual' | 'spec' }) => {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const fileName = `${itemId}_${Date.now()}.${fileExt}`;
      const filePath = `${kind === 'spec' ? 'specs' : 'manuals'}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('item-manuals')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('item-manuals')
        .getPublicUrl(filePath);

      return publicUrl;
    },
  });
}
