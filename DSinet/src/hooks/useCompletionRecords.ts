'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';
import type { CompletionRecord, CompletionRecordInput } from '@/types';

const KEY = 'completion_records';

function getAll(): CompletionRecord[] {
  return getStoredItems<CompletionRecord>(KEY);
}
function saveAll(items: CompletionRecord[]) {
  setStoredItems(KEY, items);
}

export function useSaveCompletionRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompletionRecordInput) => {
      const all = getAll();
      const newItem: CompletionRecord = {
        id: crypto.randomUUID(),
        schedule_id: input.schedule_id,
        user_id: 'local',
        apartment_name: input.apartment_name || null,
        unit_number: input.unit_number || null,
        customer_name: input.customer_name || null,
        phone: input.phone || null,
        content: input.content || null,
        amount: input.amount || 0,
        signature_data: input.signature_data || null,
        record_type: input.record_type || 'completion',
        payment_method: input.payment_method || null,
        memo: input.memo || null,
        created_at: new Date().toISOString(),
      };
      all.push(newItem);
      saveAll(all);
      return newItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['completionRecords', data.schedule_id] });
    },
  });
}

export function useCompletionRecords(scheduleId?: string) {
  return useQuery({
    queryKey: ['completionRecords', scheduleId],
    queryFn: () => getAll()
      .filter(r => r.schedule_id === scheduleId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    enabled: !!scheduleId,
  });
}

export function useDeleteCompletionRecords() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      saveAll(getAll().filter(r => r.schedule_id !== scheduleId));
      return scheduleId;
    },
    onSuccess: (scheduleId) => {
      queryClient.invalidateQueries({ queryKey: ['completionRecords', scheduleId] });
    },
  });
}
