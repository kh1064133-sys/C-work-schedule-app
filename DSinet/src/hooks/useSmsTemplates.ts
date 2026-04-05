'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';

interface SmsTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  created_at: string;
}

const KEY = 'sms_templates';

function getAll(): SmsTemplate[] {
  return getStoredItems<SmsTemplate>(KEY);
}
function saveAll(items: SmsTemplate[]) {
  setStoredItems(KEY, items);
}

export function useSmsTemplates() {
  return useQuery({
    queryKey: ['smsTemplates'],
    queryFn: () => getAll().sort((a, b) => a.name.localeCompare(b.name)),
  });
}

export function useUpsertSmsTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; name: string; content: string }) => {
      const all = getAll();
      if (input.id) {
        const target = all.find(t => t.id === input.id);
        if (target) {
          target.name = input.name;
          target.content = input.content;
          saveAll(all);
          return target;
        }
      }
      const newItem: SmsTemplate = {
        id: crypto.randomUUID(),
        user_id: 'local',
        name: input.name,
        content: input.content,
        created_at: new Date().toISOString(),
      };
      all.push(newItem);
      saveAll(all);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smsTemplates'] });
    },
  });
}
