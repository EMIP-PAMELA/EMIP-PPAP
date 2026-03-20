import { supabase } from '@/src/lib/supabaseClient';
import type { CreateConversationInput, PPAPConversation } from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

export async function createConversation(
  input: CreateConversationInput
): Promise<PPAPConversation> {
  const { data, error } = await supabase
    .from('ppap_conversations')
    .insert({
      ppap_id: input.ppap_id,
      message: input.message,
      message_type: input.message_type || 'NOTE',
      author: input.author,
      author_role: input.author_role || null,
      author_site: input.author_site || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation entry: ${error.message}`);
  }

  await logEvent({
    ppap_id: input.ppap_id,
    event_type: 'CONVERSATION_ADDED',
    actor: input.author,
    event_data: {
      message_type: input.message_type || 'NOTE',
    },
  });

  return data as PPAPConversation;
}

export async function getConversationsByPPAPId(ppapId: string): Promise<PPAPConversation[]> {
  if (!ppapId) {
    throw new Error('ppapId is required to fetch conversations');
  }

  const { data, error } = await supabase
    .from('ppap_conversations')
    .select('*')
    .eq('ppap_id', ppapId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch conversations: ${error.message}`);
  }

  return data as PPAPConversation[];
}
