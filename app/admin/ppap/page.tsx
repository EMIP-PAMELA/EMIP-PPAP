import { supabase } from '@/src/lib/supabaseClient';
import { PPAPRecord } from '@/src/types/database.types';
import { AdminDashboard } from '@/src/features/ppap/components/AdminDashboard';

export const dynamic = 'force-dynamic';

async function getAllPPAPs() {
  const { data, error } = await supabase
    .from('ppap_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching PPAPs:', error);
    return [];
  }

  return data as PPAPRecord[];
}

export default async function AdminPPAPPage() {
  const ppaps = await getAllPPAPs();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">PPAP Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Oversight and assignment control for all PPAP submissions</p>
        </div>

        <AdminDashboard ppaps={ppaps} />
      </div>
    </div>
  );
}
