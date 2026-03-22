'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPPAP } from '@/src/features/ppap/mutations';
import type { CreatePPAPInput, PPAPType } from '@/src/types/database.types';

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
      if (!formData.ppap_number || !formData.part_number || !formData.customer_name || !formData.request_date || !formData.ppap_type) {
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
            <label htmlFor="ppap_number" className="block text-sm font-semibold text-gray-700 mb-2">
              Customer PPAP Number <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              id="ppap_number"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.ppap_number || ''}
              onChange={(e) => handleChange('ppap_number', e.target.value.trim())}
              placeholder="Enter customer-assigned PPAP number"
            />
          </div>

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
            <label htmlFor="ppap_type" className="block text-sm font-semibold text-gray-700 mb-2">
              What type of PPAP is this? <span className="text-red-600">*</span>
            </label>
            <select
              id="ppap_type"
              required
              className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              value={formData.ppap_type || ''}
              onChange={(e) => handleChange('ppap_type', e.target.value as PPAPType)}
            >
              <option value="">Select PPAP Type</option>
              <option value="NPI">New Product Introduction (NPI)</option>
              <option value="CHANGE">Engineering Change / Modification</option>
              <option value="MAINTENANCE">Production / Maintenance Update</option>
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

      {/* Optional: Initial Customer Documents */}
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-8">
        <h3 className="text-xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">Initial Customer Documents (Optional)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload any initial documents received from the customer (e.g., drawings, PPAP request forms, specifications).
          This front-loads all incoming data for easier tracking.
        </p>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50 hover:bg-gray-100 transition-colors">
          <div className="space-y-2">
            <svg className="mx-auto h-10 w-10 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div className="text-sm text-gray-600">
              <label htmlFor="intake-file-upload" className="relative cursor-pointer rounded-md font-medium text-blue-600 hover:text-blue-500">
                <span>Click to upload</span>
                <input id="intake-file-upload" name="intake-file-upload" type="file" className="sr-only" multiple />
              </label>
              <span className="pl-1">or drag and drop</span>
            </div>
            <p className="text-xs text-gray-500">Customer drawings, PPAP requests, specifications (PDF, DOC, DOCX)</p>
          </div>
        </div>

        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          <p className="font-semibold">📝 Note:</p>
          <p className="mt-1">File upload backend integration pending. UI framework in place for intake document loading.</p>
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
