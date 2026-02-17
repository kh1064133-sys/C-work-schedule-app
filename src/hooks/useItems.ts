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
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Item[];
    },
  });
}

// 품목 검색
export function useSearchItems(query: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['items', 'search', query],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .ilike('name', `%${query}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (error) throw error;
      return data as Item[];
    },
    enabled: query.length > 0,
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

// 이미지 업로드 (Supabase Storage)
export function useUploadItemPhoto() {
  const supabase = createClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `items/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('photos')
        .getPublicUrl(filePath);

      return publicUrl;
    },
  });
}
