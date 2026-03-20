'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPPAP } from '@/src/features/ppap/mutations';
import type { CreatePPAPInput } from '@/src/types/database.types';

export function CreatePPAPForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CreatePPAPInput>>({
    mold_required: false,
  });

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
          <label htmlFor="part_name" className="block text-sm font-medium text-gray-700 mb-1">
            Part Name
          </label>
          <input
            type="text"
            id="part_name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.part_name || ''}
            onChange={(e) => handleChange('part_name', e.target.value)}
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
          <label htmlFor="customer_code" className="block text-sm font-medium text-gray-700 mb-1">
            Customer Code
          </label>
          <input
            type="text"
            id="customer_code"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.customer_code || ''}
            onChange={(e) => handleChange('customer_code', e.target.value)}
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
          <label htmlFor="submission_level" className="block text-sm font-medium text-gray-700 mb-1">
            Submission Level
          </label>
          <select
            id="submission_level"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.submission_level || ''}
            onChange={(e) => handleChange('submission_level', e.target.value)}
          >
            <option value="">Select Level</option>
            <option value="1">Level 1</option>
            <option value="2">Level 2</option>
            <option value="3">Level 3</option>
            <option value="4">Level 4</option>
            <option value="5">Level 5</option>
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

        <div>
          <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
            Due Date
          </label>
          <input
            type="date"
            id="due_date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={formData.due_date || ''}
            onChange={(e) => handleChange('due_date', e.target.value)}
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Mold Information</h3>
        
        <div className="mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              checked={formData.mold_required || false}
              onChange={(e) => handleChange('mold_required', e.target.checked)}
            />
            <span className="ml-2 text-sm text-gray-700">Mold Required</span>
          </label>
        </div>

        {formData.mold_required && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="mold_supplier" className="block text-sm font-medium text-gray-700 mb-1">
                Mold Supplier
              </label>
              <input
                type="text"
                id="mold_supplier"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.mold_supplier || ''}
                onChange={(e) => handleChange('mold_supplier', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="mold_lead_time_days" className="block text-sm font-medium text-gray-700 mb-1">
                Mold Lead Time (days)
              </label>
              <input
                type="number"
                id="mold_lead_time_days"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.mold_lead_time_days || ''}
                onChange={(e) => handleChange('mold_lead_time_days', parseInt(e.target.value))}
              />
            </div>

            <div>
              <label htmlFor="process_type" className="block text-sm font-medium text-gray-700 mb-1">
                Process Type
              </label>
              <select
                id="process_type"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.process_type || ''}
                onChange={(e) => handleChange('process_type', e.target.value)}
              >
                <option value="">Select Type</option>
                <option value="INJECTION_MOLDING">Injection Molding</option>
                <option value="OVERMOLDING">Overmolding</option>
                <option value="INSERT_MOLDING">Insert Molding</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <textarea
          id="notes"
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          value={formData.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
        />
      </div>

      <div className="flex gap-4">
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
