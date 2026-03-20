'use client';

import { useState } from 'react';
import { createTask } from '@/src/features/tasks/mutations';

interface AddTaskFormProps {
  ppapId: string;
  onSuccess?: () => void;
}

export function AddTaskForm({ ppapId, onSuccess }: AddTaskFormProps) {
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) return;

    setLoading(true);

    try {
      await createTask({
        ppap_id: ppapId,
        title: title.trim(),
        phase: phase || undefined,
        assigned_to: assignedTo || undefined,
        due_date: dueDate || undefined,
      }, 'Matt');

      setTitle('');
      setPhase('');
      setAssignedTo('');
      setDueDate('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to add task:', err);
      alert('Failed to add task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 pt-4 mt-4">
      <div className="space-y-3">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Task title..."
            disabled={loading}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="phase" className="block text-sm font-medium text-gray-700 mb-1">
              Phase
            </label>
            <input
              id="phase"
              type="text"
              value={phase}
              onChange={(e) => setPhase(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="e.g., Design, Build"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="assigned_to" className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <input
              id="assigned_to"
              type="text"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Name"
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
            Due Date
          </label>
          <input
            id="due_date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            disabled={loading}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !title.trim()}
        className="mt-3 w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding...' : 'Add Task'}
      </button>
    </form>
  );
}
