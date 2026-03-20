'use client';

import { PPAPTask } from '@/src/types/database.types';
import { formatDate } from '@/src/lib/utils';
import { updateTaskStatus } from '@/src/features/tasks/mutations';
import { useState } from 'react';
import { AddTaskForm } from './AddTaskForm';

interface TaskListProps {
  ppapId: string;
  tasks: PPAPTask[];
}

export function TaskList({ ppapId, tasks }: TaskListProps) {
  const pendingTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  const handleTaskAdded = () => {
    window.location.reload();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Tasks</h2>

      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No tasks yet.</p>
          <p className="text-sm text-gray-400">Add the first task to start tracking work.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pendingTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Active Tasks</h3>
              <div className="space-y-2">
                {pendingTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}

          {completedTasks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Completed Tasks</h3>
              <div className="space-y-2">
                {completedTasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AddTaskForm ppapId={ppapId} onSuccess={handleTaskAdded} />
    </div>
  );
}

function TaskItem({ task }: { task: PPAPTask }) {
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateTaskStatus(task.id, 'completed', 'Matt');
      window.location.reload();
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{task.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
              {task.status}
            </span>
            {task.phase && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {task.phase.replace(/_/g, ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {task.assigned_to && (
              <span>Assigned: {task.assigned_to}</span>
            )}
            {task.due_date && (
              <span>Due: {formatDate(task.due_date)}</span>
            )}
            {task.completed_at && (
              <span>Completed: {formatDate(task.completed_at)}</span>
            )}
          </div>
        </div>
        {task.status !== 'completed' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="ml-4 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Completing...' : 'Mark Complete'}
          </button>
        )}
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-700',
    blocked: 'bg-red-100 text-red-700',
    completed: 'bg-green-100 text-green-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };
  
  return colors[status] || 'bg-gray-100 text-gray-700';
}
