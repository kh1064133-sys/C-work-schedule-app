'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';
import type { Item, ItemInput } from '@/types';

const KEY = 'items';

function getAll(): Item[] {
  return getStoredItems<Item>(KEY);
}
function saveAll(items: Item[]) {
  setStoredItems(KEY, items);
}

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: () => getAll().sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useSearchItems(query: string) {
  return useQuery({
    queryKey: ['items', 'search', query],
    queryFn: () => {
      const q = query.toLowerCase();
      return getAll()
        .filter(i => i.name.toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 20);
    },
    enabled: query.length > 0,
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ItemInput) => {
      const all = getAll();
      const newItem: Item = {
        id: crypto.randomUUID(),
        user_id: 'local',
        name: input.name,
        price: input.price || 0,
        category: input.category || null,
        memo: input.memo || null,
        photo_url: input.photo_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      all.push(newItem);
      saveAll(all);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ItemInput & { id: string }) => {
      const all = getAll();
      const target = all.find(i => i.id === id);
      if (!target) throw new Error('Not found');
      Object.assign(target, input, { updated_at: new Date().toISOString() });
      saveAll(all);
      return target;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      saveAll(getAll().filter(i => i.id !== id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}

// 사진 업로드 → base64로 localStorage에 저장
export function useUploadItemPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          const all = getAll();
          const target = all.find(i => i.id === id);
          if (!target) { reject(new Error('Not found')); return; }
          target.photo_url = base64;
          target.updated_at = new Date().toISOString();
          saveAll(all);
          resolve(base64);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
