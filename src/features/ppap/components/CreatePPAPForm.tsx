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
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-300 text-red-800 px-6 py-4 rounded-lg shadow-sm">
          <p className="font-bold text-base">Error</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      )}

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">PPAP Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="part_number" className="block text-sm font-semibold text-gray-700 mb-2">
              Part Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="part_number"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.part_number || ''}
              onChange={(e) => handleChange('part_number', e.target.value)}
              placeholder="Enter part number"
            />
          </div>

          <div>
            <label htmlFor="customer_name" className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="customer_name"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.customer_name || ''}
              onChange={(e) => handleChange('customer_name', e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          <div>
            <label htmlFor="plant" className="block text-sm font-semibold text-gray-700 mb-2">
              Plant <span className="text-red-600">*</span>
            </label>
            <select
              id="plant"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
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
            <label htmlFor="request_date" className="block text-sm font-semibold text-gray-700 mb-2">
              Request Date <span className="text-red-600">*</span>
            </label>
            <input
              type="date"
              id="request_date"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.request_date || ''}
              onChange={(e) => handleChange('request_date', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm"
        >
          {loading ? 'Creating...' : 'Create PPAP'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="bg-white border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
