import { supabase } from '@/src/lib/supabaseClient';

export interface PPAPDocument {
  file_name: string;
  file_path: string;
  document_type?: string;
}

export async function getPPAPDocuments(ppapId: string): Promise<PPAPDocument[]> {
  const { data, error } = await supabase
    .from('ppap_events')
    .select('*')
    .eq('ppap_id', ppapId)
    .eq('event_type', 'DOCUMENT_ADDED')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || [])
    .map(e => e.event_data)
    .filter(d =>
      d &&
      typeof d.file_path === 'string' &&
      d.file_path.length > 0 &&
      !d.markup
    );
}
