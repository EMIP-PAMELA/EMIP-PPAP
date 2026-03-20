import { supabase } from '@/src/lib/supabaseClient';
import type { CreateEventInput, PPAPEvent } from '@/src/types/database.types';

export async function logEvent(input: CreateEventInput): Promise<PPAPEvent> {
  if (!input.ppap_id) {
    throw new Error('ppap_id is required for event logging');
  }

  const { data, error } = await supabase
    .from('ppap_events')
    .insert({
      ppap_id: input.ppap_id,
      event_type: input.event_type,
      event_data: input.event_data || null,
      actor: input.actor,
      actor_role: input.actor_role || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to log event: ${error.message}`);
  }

  return data as PPAPEvent;
}

export async function getEventsByPPAPId(ppapId: string, limit = 50): Promise<PPAPEvent[]> {
  if (!ppapId) {
    throw new Error('ppapId is required to fetch events');
  }

  const { data, error } = await supabase
    .from('ppap_events')
    .select('*')
    .eq('ppap_id', ppapId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`);
  }

  return data as PPAPEvent[];
}
