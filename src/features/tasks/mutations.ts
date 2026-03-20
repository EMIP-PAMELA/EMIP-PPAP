import { supabase } from '@/src/lib/supabaseClient';
import type { CreateTaskInput, PPAPTask } from '@/src/types/database.types';
import { logEvent } from '@/src/features/events/mutations';

export async function createTask(input: CreateTaskInput, actor: string = 'Matt'): Promise<PPAPTask> {
  const { data, error } = await supabase
    .from('ppap_tasks')
    .insert({
      ppap_id: input.ppap_id,
      title: input.title,
      phase: input.phase || null,
      assigned_to: input.assigned_to || null,
      due_date: input.due_date || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  await logEvent({
    ppap_id: input.ppap_id,
    event_type: 'TASK_CREATED',
    actor: actor,
    event_data: {
      task_id: data.id,
      title: input.title,
      phase: input.phase || null,
      assigned_to: input.assigned_to || null,
    },
  });

  return data as PPAPTask;
}

export async function updateTaskStatus(
  taskId: string,
  newStatus: string,
  actor: string
): Promise<PPAPTask> {
  const updateData: Record<string, unknown> = {
    status: newStatus,
  };

  if (newStatus === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('ppap_tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update task status: ${error.message}`);
  }

  if (newStatus === 'completed') {
    await logEvent({
      ppap_id: data.ppap_id,
      event_type: 'TASK_COMPLETED',
      actor,
      event_data: {
        task_id: taskId,
        title: data.title,
      },
    });
  }

  return data as PPAPTask;
}

export async function getTasksByPPAPId(ppapId: string): Promise<PPAPTask[]> {
  if (!ppapId) {
    throw new Error('ppapId is required to fetch tasks');
  }

  const { data, error } = await supabase
    .from('ppap_tasks')
    .select('*')
    .eq('ppap_id', ppapId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return data as PPAPTask[];
}

