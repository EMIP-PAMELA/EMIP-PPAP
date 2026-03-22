import { supabase } from '@/src/lib/supabaseClient';

export async function uploadPPAPDocument(file: File, ppapId: string): Promise<string> {
  const filePath = `${ppapId}/${Date.now()}-${file.name}`;

  const { data, error } = await supabase.storage
    .from('ppap-documents')
    .upload(filePath, file);

  if (error) throw new Error(error.message);

  return data.path;
}

export async function downloadPPAPDocument(filePath: string): Promise<string> {
  const { data } = await supabase.storage
    .from('ppap-documents')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
