import { supabase } from '@/src/lib/supabaseClient';
import type { PPAPRecord, PPAPStatus } from '@/src/types/database.types';

export interface PPAPListFilters {
  status?: PPAPStatus;
  plant?: string;
  customer?: string;
  assigned_to?: string;
  department?: string; // V3.3A.5: Filter by department queue
  unclaimed?: boolean; // V3.3A.5: Show only unclaimed PPAPs in queue
  mold_required?: boolean;
}

export async function getAllPPAPs(filters?: PPAPListFilters) {
  let query = supabase
    .from('ppap_records')
    .select('*')
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

  // V3.3A.5: Department queue filtering
  if (filters?.department) {
    query = query.eq('department', filters.department);
  }

  // V3.3A.5: Unclaimed filter (department queue)
  if (filters?.unclaimed === true) {
    query = query.is('assigned_to', null);
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
  if (!id) {
    throw new Error('PPAP ID is required');
  }

  // Phase 3F.5: Verify PPAP ID
  console.log('Phase 3F.5 - PPAP ID CHECK (getPPAPById)', id);

  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  // Phase 3F.10: GLOBAL TRACE - Log every PPAP read
  console.log('👀 PPAP FETCH', {
    id,
    status: data?.status,
    timestamp: new Date().toISOString(),
  });

  if (error) {
    console.error('Phase 3F.5 - FETCH ERROR', {
      id,
      error: error.message,
    });
    throw new Error(`Failed to fetch PPAP: ${error.message}`);
  }

  if (!data) {
    // Phase 3F.5: Critical error - PPAP not found after refresh
    console.error('Phase 3F.5 - CRITICAL: PPAP NOT FOUND AFTER REFRESH', {
      id,
      data,
    });
    throw new Error(`PPAP not found with ID: ${id}`);
  }

  // Phase 3F.5: Log PPAP fetched in UI
  console.log('Phase 3F.5 - PPAP FETCHED IN UI', {
    id: data.id,
    status: data.status,
    ppap_number: data.ppap_number,
    updated_at: data.updated_at,
  });

  return data as PPAPRecord;
}

export async function getPPAPByNumber(ppapNumber: string) {
  if (!ppapNumber) {
    throw new Error('PPAP number is required');
  }

  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .eq('ppap_number', ppapNumber)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch PPAP: ${error.message}`);
  }

  if (!data) {
    throw new Error(`PPAP not found with number: ${ppapNumber}`);
  }

  return data as PPAPRecord;
}

export async function getOverduePPAPs() {
  const today = new Date().toISOString();

  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
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
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch PPAPs for plant: ${error.message}`);
  }

  return data as PPAPRecord[];
}

export async function getPPAPDashboardStats() {
  const { data, error } = await supabase
    .from('ppap_records')
    .select('status');

  if (error) {
    throw new Error(`Failed to fetch dashboard stats: ${error.message}`);
  }

  const stats = {
    total: data.length,
    byStatus: {} as Record<PPAPStatus, number>,
    overdue: 0,
  };

  const today = new Date().toISOString();

  data.forEach((record) => {
    const status = record.status as PPAPStatus;
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
  });

  const overdueData = await getOverduePPAPs();
  stats.overdue = overdueData.length;

  return stats;
}
