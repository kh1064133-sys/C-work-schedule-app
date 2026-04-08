'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';
import type { WorkType, WorkTypeInput } from '@/types';

const KEY = 'workTypes';

function getAll(): WorkType[] {
  return getStoredItems<WorkType>(KEY);
}
function saveAll(items: WorkType[]) {
  setStoredItems(KEY, items);
}

export function useWorkTypes() {
  return useQuery({
    queryKey: ['workTypes'],
    queryFn: () => getAll().sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useSearchWorkTypes(query: string) {
  return useQuery({
    queryKey: ['workTypes', 'search', query],
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

export function useCreateWorkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: WorkTypeInput) => {
      const all = getAll();
      const newItem: WorkType = {
        id: crypto.randomUUID(),
        user_id: 'local',
        name: input.name,
        spec: input.spec || null,
        unit: input.unit || null,
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
      queryClient.invalidateQueries({ queryKey: ['workTypes'] });
    },
  });
}

export function useUpdateWorkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: WorkTypeInput & { id: string }) => {
      const all = getAll();
      const target = all.find(i => i.id === id);
      if (!target) throw new Error('Not found');
      Object.assign(target, input, { updated_at: new Date().toISOString() });
      saveAll(all);
      return target;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTypes'] });
    },
  });
}

export function useDeleteWorkType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const all = getAll();
      saveAll(all.filter(i => i.id !== id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workTypes'] });
    },
  });
}
