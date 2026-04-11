'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';
import type { Client, ClientInput } from '@/types';

const KEY = 'clients';

function getAll(): Client[] {
  return getStoredItems<Client>(KEY);
}
function saveAll(items: Client[]) {
  setStoredItems(KEY, items);
}

export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: () => getAll().sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useSearchClients(query: string) {
  return useQuery({
    queryKey: ['clients', 'search', query],
    queryFn: () => {
      const q = query.toLowerCase();
      return getAll()
        .filter(c => c.name.toLowerCase().includes(q) || (c.address && c.address.toLowerCase().includes(q)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 20);
    },
    enabled: query.length > 0,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientInput) => {
      const all = getAll();
      const newItem: Client = {
        id: crypto.randomUUID(),
        user_id: 'local',
        name: input.name,
        contact_person: input.contact_person || null,
        phone: input.phone || null,
        mobile: input.mobile || null,
        fax: input.fax || null,
        address: input.address || null,
        homepage: input.homepage || null,
        memo: input.memo || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      all.push(newItem);
      saveAll(all);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: ClientInput & { id: string }) => {
      const all = getAll();
      const target = all.find(c => c.id === id);
      if (!target) throw new Error('Not found');
      Object.assign(target, input, { updated_at: new Date().toISOString() });
      saveAll(all);
      return target;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      saveAll(getAll().filter(c => c.id !== id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
