import { supabase } from '@/src/lib/supabaseClient';
import type { CreateDocumentInput, PPAPDocument } from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';
import { checkFileExists } from '@/src/features/vault/queries';

export async function createDocument(input: CreateDocumentInput): Promise<PPAPDocument> {
  const { data, error } = await supabase
    .from('ppap_documents')
    .insert({
      ppap_id: input.ppap_id,
      file_name: input.file_name,
      category: input.category || null,
      file_url: input.file_url || null,
      uploaded_by: input.uploaded_by,
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
      file_name: input.file_name,
      category: input.category,
    },
  });

  return data as PPAPDocument;
}

export async function getDocumentsByPPAPId(ppapId: string): Promise<PPAPDocument[]> {
  if (!ppapId) {
    throw new Error('ppapId is required to fetch documents');
  }

  const { data, error } = await supabase
    .from('ppap_documents')
    .select('*')
    .eq('ppap_id', ppapId);

  if (error) {
    throw new Error(`Failed to fetch documents: ${error.message}`);
  }

  return data as PPAPDocument[];
}
