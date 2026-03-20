import { supabase } from '@/src/lib/supabaseClient';
import type { CreateDocumentInput, PPAPDocument } from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

export async function createDocument(input: CreateDocumentInput): Promise<PPAPDocument> {
  const { data, error } = await supabase
    .from('ppap_documents')
    .insert({
      ppap_id: input.ppap_id,
      document_name: input.document_name,
      document_type: input.document_type,
      file_size_bytes: input.file_size_bytes || null,
      mime_type: input.mime_type || null,
      storage_path: input.storage_path || null,
      storage_bucket: input.storage_bucket || null,
      uploaded_by: input.uploaded_by,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create document: ${error.message}`);
  }

  await logEvent({
    ppap_id: input.ppap_id,
    event_type: 'DOCUMENT_ADDED',
    actor: input.uploaded_by,
    event_data: {
      document_id: data.id,
      document_name: input.document_name,
      document_type: input.document_type,
    },
  });

  return data as PPAPDocument;
}

export async function getDocumentsByPPAPId(ppapId: string): Promise<PPAPDocument[]> {
  const { data, error } = await supabase
    .from('ppap_documents')
    .select('*')
    .eq('ppap_id', ppapId)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data as PPAPDocument[];
}
