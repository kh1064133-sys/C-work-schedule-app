'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { VehicleMaintenance, VehicleMaintenanceInput, FuelRecord, FuelRecordInput } from '@/types';

const TEMP_USER_ID = '00000000-0000-0000-0000-000000000001';

// ===== 정비이력 =====
export function useMaintenanceRecords() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['vehicle_maintenance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_maintenance')
        .select('*')
        .eq('user_id', TEMP_USER_ID)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as VehicleMaintenance[];
    },
  });
}

export function useUpsertMaintenance() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: VehicleMaintenanceInput & { id?: string }) => {
      const { data, error } = await supabase
        .from('vehicle_maintenance')
        .upsert({ ...input, user_id: TEMP_USER_ID })
        .select()
        .single();
      if (error) throw error;
      return data as VehicleMaintenance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_maintenance'] });
    },
  });
}

export function useDeleteMaintenance() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vehicle_maintenance').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle_maintenance'] });
    },
  });
}

// ===== 주유관리 =====
export function useFuelRecords() {
  const supabase = createClient();
  return useQuery({
    queryKey: ['fuel_records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fuel_records')
        .select('*')
        .eq('user_id', TEMP_USER_ID)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as FuelRecord[];
    },
  });
}

export function useUpsertFuel() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: FuelRecordInput & { id?: string }) => {
      const { data, error } = await supabase
        .from('fuel_records')
        .upsert({ ...input, user_id: TEMP_USER_ID })
        .select()
        .single();
      if (error) throw error;
      return data as FuelRecord;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_records'] });
    },
  });
}

export function useDeleteFuel() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fuel_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuel_records'] });
    },
  });
}
