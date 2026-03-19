import { supabase } from '@/src/lib/supabaseClient';
import type { PPAPRecord, PPAPStatus } from '@/src/types/database.types';

export interface PPAPListFilters {
  status?: PPAPStatus;
  plant?: string;
  customer?: string;
  assigned_to?: string;
  mold_required?: boolean;
}

export async function getAllPPAPs(filters?: PPAPListFilters) {
  let query = supabase
    .from('ppap_records')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.plant) {
    query = query.eq('plant', filters.plant);
  }

  if (filters?.customer) {
    query = query.ilike('customer_name', `%${filters.customer}%`);
  }

  if (filters?.assigned_to) {
    query = query.eq('assigned_to', filters.assigned_to);
  }

  if (filters?.mold_required !== undefined) {
    query = query.eq('mold_required', filters.mold_required);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch PPAPs: ${error.message}`);
  }

  return data as PPAPRecord[];
}

export async function getPPAPById(id: string) {
  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) {
    throw new Error(`Failed to fetch PPAP: ${error.message}`);
  }

  return data as PPAPRecord;
}

export async function getPPAPByNumber(ppapNumber: string) {
  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .eq('ppap_number', ppapNumber)
    .is('deleted_at', null)
    .single();

  if (error) {
    throw new Error(`Failed to fetch PPAP: ${error.message}`);
  }

  return data as PPAPRecord;
}

export async function getOverduePPAPs() {
  const today = new Date().toISOString();

  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .is('deleted_at', null)
    .lt('due_date', today)
    .not('status', 'in', '(APPROVED,CLOSED)')
    .order('due_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch overdue PPAPs: ${error.message}`);
  }

  return data as PPAPRecord[];
}

export async function getPPAPsByPlant(plant: string) {
  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .eq('plant', plant)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch PPAPs for plant: ${error.message}`);
  }

  return data as PPAPRecord[];
}

export async function getPPAPDashboardStats() {
  const { data, error } = await supabase
    .from('ppap_records')
    .select('status, mold_required')
    .is('deleted_at', null);

  if (error) {
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }

  const stats = {
    total: data.length,
    byStatus: {} as Record<PPAPStatus, number>,
    moldRequired: 0,
    overdue: 0,
  };

  const today = new Date().toISOString();

  data.forEach((record) => {
    const status = record.status as PPAPStatus;
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    if (record.mold_required) {
      stats.moldRequired++;
    }
  });

  const overdueData = await getOverduePPAPs();
  stats.overdue = overdueData.length;

  return stats;
}
