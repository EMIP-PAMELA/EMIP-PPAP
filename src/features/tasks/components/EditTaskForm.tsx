'use client';

import { useState } from 'react';
import { PPAPTask } from '@/src/types/database.types';
import { updateTask } from '@/src/features/tasks/mutations';

interface EditTaskFormProps {
  task: PPAPTask;
  onSuccess: () => void;
  onCancel: () => void;
}

export function EditTaskForm({ task, onSuccess, onCancel }: EditTaskFormProps) {
  const [title, setTitle] = useState(task.title || '');
  const [phase, setPhase] = useState(task.phase || '');
  const [assignedTo, setAssignedTo] = useState(task.assigned_to || '');
  const [dueDate, setDueDate] = useState(task.due_date || '');
  const [status, setStatus] = useState(task.status);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Task title is required');
      return;
    }

    setLoading(true);

    try {
      await updateTask(
        task.id,
        {
          title: title.trim(),
          phase: phase.trim() || undefined,
          assigned_to: assignedTo.trim() || undefined,
          due_date: dueDate || undefined,
          status,
        },
        'Matt'
      );

      onSuccess();
    } catch (error) {
      console.error('Failed to update task:', error);
      alert('Failed to update task. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border border-gray-300 rounded-lg p-4 bg-gray-50">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Edit Task</h4>

      <div className="space-y-3">
        <div>
          <label htmlFor="title" className="block text-xs font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phase" className="block text-xs font-medium text-gray-700 mb-1">
              Phase
            </label>
            <input
              id="phase"
              type="text"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              placeholder="e.g., Pre-Ack"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="status" className="block text-xs font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="assignedTo" className="block text-xs font-medium text-gray-700 mb-1">
              Assigned To
            </label>
            <input
              id="assignedTo"
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="e.g., Matt"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-xs font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
