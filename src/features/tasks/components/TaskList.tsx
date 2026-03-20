'use client';

import { PPAPTask } from '@/src/types/database.types';
import { formatDate } from '@/src/lib/utils';
import { updateTaskStatus, deleteTask } from '@/src/features/tasks/mutations';
import { useState, useMemo } from 'react';
import { AddTaskForm } from './AddTaskForm';
import { EditTaskForm } from './EditTaskForm';
import { sortTasksByPriority, isOverdue, isDueToday } from '@/src/features/tasks/utils/taskUtils';

interface TaskListProps {
  ppapId: string;
  tasks: PPAPTask[];
}

export function TaskList({ ppapId, tasks }: TaskListProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [dueDateFilter, setDueDateFilter] = useState<'all' | 'today' | 'overdue'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [quickFilter, setQuickFilter] = useState<'none' | 'overdue' | 'active'>('none');

  const handleTaskAdded = () => {
    window.location.reload();
  };

  const uniqueAssignees = useMemo(() => {
    const assignees = tasks
      .map(t => t.assigned_to)
      .filter((a): a is string => !!a);
    return Array.from(new Set(assignees));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    if (quickFilter === 'overdue') {
      filtered = filtered.filter(t => isOverdue(t));
    } else if (quickFilter === 'active') {
      filtered = filtered.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    } else {
      if (statusFilter === 'active') {
        filtered = filtered.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
      } else if (statusFilter === 'completed') {
        filtered = filtered.filter(t => t.status === 'completed');
      }

      if (dueDateFilter === 'today') {
        filtered = filtered.filter(t => isDueToday(t));
      } else if (dueDateFilter === 'overdue') {
        filtered = filtered.filter(t => isOverdue(t));
      }

      if (assigneeFilter !== 'all') {
        filtered = filtered.filter(t => t.assigned_to === assigneeFilter);
      }
    }

    return sortTasksByPriority(filtered);
  }, [tasks, statusFilter, dueDateFilter, assigneeFilter, quickFilter]);

  const clearFilters = () => {
    setStatusFilter('all');
    setDueDateFilter('all');
    setAssigneeFilter('all');
    setQuickFilter('none');
  };

  const hasActiveFilters = statusFilter !== 'all' || dueDateFilter !== 'all' || assigneeFilter !== 'all' || quickFilter !== 'none';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Tasks</h2>

      {tasks.length > 0 && (
        <>
          <div className="mb-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setQuickFilter(quickFilter === 'overdue' ? 'none' : 'overdue')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  quickFilter === 'overdue'
                    ? 'bg-red-600 text-white'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                🔴 Show Overdue Only
              </button>
              <button
                onClick={() => setQuickFilter(quickFilter === 'active' ? 'none' : 'active')}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  quickFilter === 'active'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                Show Active Only
              </button>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>

            {quickFilter === 'none' && (
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <select
                    value={dueDateFilter}
                    onChange={(e) => setDueDateFilter(e.target.value as any)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="today">Due Today</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Assignee</label>
                  <select
                    value={assigneeFilter}
                    onChange={(e) => setAssigneeFilter(e.target.value)}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    {uniqueAssignees.map((assignee) => (
                      <option key={assignee} value={assignee}>
                        {assignee}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">No tasks yet.</p>
          <p className="text-sm text-gray-400">Add the first task to start tracking work.</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-2">No tasks match current filters</p>
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => (
            <TaskItem key={task.id} task={task} onUpdate={handleTaskAdded} />
          ))}
        </div>
      )}

      <AddTaskForm ppapId={ppapId} onSuccess={handleTaskAdded} />
    </div>
  );
}

function TaskItem({ task, onUpdate }: { task: PPAPTask; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateTaskStatus(task.id, 'completed', 'Matt');
      onUpdate();
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('Failed to complete task');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm('Delete this task?');
    if (!confirmed) return;

    setLoading(true);
    try {
      await deleteTask(task.id, 'Matt');
      onUpdate();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('Failed to delete task');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSuccess = () => {
    setEditing(false);
    onUpdate();
  };

  if (editing) {
    return (
      <EditTaskForm
        task={task}
        onSuccess={handleEditSuccess}
        onCancel={() => setEditing(false)}
      />
    );
  }

  const taskIsOverdue = isOverdue(task);
  const taskIsDueToday = isDueToday(task);

  return (
    <div className={`border rounded-lg p-4 ${
      taskIsOverdue ? 'border-red-400 bg-red-50' : 
      taskIsDueToday ? 'border-yellow-400 bg-yellow-50' : 
      'border-gray-200'
    }`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{task.title}</h4>
            {taskIsOverdue && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-600 text-white font-semibold">
                🔴 Overdue
              </span>
            )}
            {!taskIsOverdue && taskIsDueToday && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-600 text-white font-semibold">
                🟡 Due Today
              </span>
            )}
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
              <span className={taskIsOverdue ? 'text-red-700 font-semibold' : ''}>
                Due: {formatDate(task.due_date)}
              </span>
            )}
            {task.completed_at && (
              <span>Completed: {formatDate(task.completed_at)}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2 ml-4">
          {task.status !== 'completed' && (
            <>
              <button
                onClick={() => setEditing(true)}
                disabled={loading}
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Edit
              </button>
              <button
                onClick={handleComplete}
                disabled={loading}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {loading ? 'Completing...' : 'Complete'}
              </button>
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={loading}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
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
