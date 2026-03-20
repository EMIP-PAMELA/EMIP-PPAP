'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPPAP } from '@/src/features/ppap/mutations';
import type { CreatePPAPInput } from '@/src/types/database.types';

export function CreatePPAPForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CreatePPAPInput>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.part_number || !formData.customer_name || !formData.plant || !formData.request_date) {
        throw new Error('Please fill in all required fields');
      }

      const ppap = await createPPAP(formData as CreatePPAPInput);
      router.push(`/ppap/${ppap.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PPAP');
      setLoading(false);
    }
  };

  const handleChange = (field: keyof CreatePPAPInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="part_number" className="block text-sm font-medium text-gray-700 mb-1">
            Part Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="part_number"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.part_number || ''}
            onChange={(e) => handleChange('part_number', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-1">
            Customer Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="customer_name"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customer_name || ''}
            onChange={(e) => handleChange('customer_name', e.target.value)}
          />
        </div>

        <div>
          <label htmlFor="plant" className="block text-sm font-medium text-gray-700 mb-1">
            Plant <span className="text-red-500">*</span>
          </label>
          <select
            id="plant"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.plant || ''}
            onChange={(e) => handleChange('plant', e.target.value)}
          >
            <option value="">Select Plant</option>
            <option value="Van Buren">Van Buren</option>
            <option value="Ball Ground">Ball Ground</option>
            <option value="Warner Robins">Warner Robins</option>
          </select>
        </div>

        <div>
          <label htmlFor="request_date" className="block text-sm font-medium text-gray-700 mb-1">
            Request Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="request_date"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.request_date || ''}
            onChange={(e) => handleChange('request_date', e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating...' : 'Create PPAP'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
