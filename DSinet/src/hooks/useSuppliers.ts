'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';

interface SupplierCompany {
  id: string;
  user_id: string;
  company_index: number;
  name: string;
  ceo: string;
  biz_no: string;
  address: string | null;
  tel: string;
  email: string;
  stamp_img: string | null;
  bank_name: string;
  account_no: string;
  account_holder: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const KEY = 'supplier_companies';

function getAll(): SupplierCompany[] {
  return getStoredItems<SupplierCompany>(KEY);
}
function saveAll(items: SupplierCompany[]) {
  setStoredItems(KEY, items);
}

export function useSupplierCompanies() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => getAll().sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useUpsertSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SupplierCompany> & { name: string }) => {
      const all = getAll();
      if (input.id) {
        const target = all.find(s => s.id === input.id);
        if (target) {
          Object.assign(target, input, { updated_at: new Date().toISOString() });
          saveAll(all);
          return target;
        }
      }
      const newItem: SupplierCompany = {
        id: crypto.randomUUID(),
        user_id: 'local',
        company_index: input.company_index ?? Date.now(),
        name: input.name,
        ceo: input.ceo || '',
        biz_no: input.biz_no || '',
        address: input.address || null,
        tel: input.tel || '',
        email: input.email || '',
        stamp_img: input.stamp_img || null,
        bank_name: input.bank_name || '',
        account_no: input.account_no || '',
        account_holder: input.account_holder || '',
        is_active: input.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      all.push(newItem);
      saveAll(all);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      saveAll(getAll().filter(s => s.id !== id));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
