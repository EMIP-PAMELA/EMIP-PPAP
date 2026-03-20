'use client';

import { useState } from 'react';
import { createConversation } from '@/src/features/conversations/mutations';

interface AddConversationFormProps {
  ppapId: string;
  onSuccess?: () => void;
}

export function AddConversationForm({ ppapId, onSuccess }: AddConversationFormProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  console.log('AddConversationForm - message:', message, 'trimmed:', message.trim(), 'disabled:', loading || !message.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    setLoading(true);

    try {
      await createConversation({
        ppap_id: ppapId,
        message: message.trim(),
        message_type: 'NOTE',
        author: 'Matt',
        author_site: 'Van Buren',
      });

      setMessage('');
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to add note:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-200 pt-4 mt-4">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="Add a note..."
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !message.trim()}
        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? 'Adding...' : 'Add Note'}
      </button>
    </form>
  );
}
