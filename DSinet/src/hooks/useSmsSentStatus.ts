'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getStoredItems, setStoredItems } from '@/lib/storage';

interface SmsSentStatus {
  id: string;
  schedule_id: string;
  user_id: string;
  sent_at: string;
}

const KEY = 'sms_sent_status';

function getAll(): SmsSentStatus[] {
  return getStoredItems<SmsSentStatus>(KEY);
}
function saveAll(items: SmsSentStatus[]) {
  setStoredItems(KEY, items);
}

export function useSmsSentStatusAll() {
  return useQuery({
    queryKey: ['smsSentStatus'],
    queryFn: () => getAll(),
  });
}

export function useMarkSmsSent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      const all = getAll();
      const newItem: SmsSentStatus = {
        id: crypto.randomUUID(),
        schedule_id: scheduleId,
        user_id: 'local',
        sent_at: new Date().toISOString(),
      };
      all.push(newItem);
      saveAll(all);
      return newItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smsSentStatus'] });
    },
  });
}
