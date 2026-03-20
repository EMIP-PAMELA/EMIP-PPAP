import { PPAPTask } from '@/src/types/database.types';

export function isOverdue(task: PPAPTask): boolean {
  if (!task.due_date || task.completed_at) return false;
  return new Date(task.due_date) < new Date();
}

export function isDueToday(task: PPAPTask): boolean {
  if (!task.due_date) return false;
  const today = new Date();
  const due = new Date(task.due_date);
  return due.toDateString() === today.toDateString();
}

export function getTaskPriorityScore(task: PPAPTask): number {
  if (task.completed_at) return 5;
  if (isOverdue(task)) return 1;
  if (isDueToday(task)) return 2;
  if (task.status === 'in_progress') return 3;
  if (task.status === 'pending') return 4;
  return 6;
}

export function sortTasksByPriority(tasks: PPAPTask[]): PPAPTask[] {
  return [...tasks].sort((a, b) => {
    const scoreA = getTaskPriorityScore(a);
    const scoreB = getTaskPriorityScore(b);
    return scoreA - scoreB;
  });
}

export function getTaskCounts(tasks: PPAPTask[]) {
  const total = tasks.length;
  const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const overdue = tasks.filter(t => isOverdue(t)).length;
  
  return { total, active, completed, overdue };
}
