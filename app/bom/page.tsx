'use client';

/**
 * V6.1 EMIP System Shell - BOM Repository Page (Real Service Integration)
 * 
 * UI LAYER - BOM List and Access
 * 
 * Responsibilities:
 * - Display active BOMs from bomService
 * - Provide access to raw artifacts
 * - Provide access to simplified projections
 * - Enable navigation to BOM details
 * 
 * Architecture:
 * - Consumes bomService for real data
 * - Pure display component
 * - Links to artifact and projection views
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import Link from 'next/link';
import { getAllActiveBOMs } from '@/src/core/services/bomService';

interface BOMListItem {
  partNumber: string;
  revision: string;
  revisionOrder: number;
  recordCount: number;
  ingestionBatchId: string;
  hasArtifact: boolean;
  updatedAt: string;
}

export default function BOMPage() {
  const [boms, setBOMs] = useState<BOMListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBOMs();
  }, []);

  const loadBOMs = async () => {
    console.log('🧭 V6.1 [BOM Page] Loading BOMs', {
      timestamp: new Date().toISOString()
    });

    try {
      const data = await getAllActiveBOMs();
      setBOMs(data);
      setLoading(false);
    } catch (err) {
      console.error('🧭 [BOM Page] Error loading BOMs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load BOMs');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-lg text-gray-600">Loading BOMs...</p>
          </div>
        </div>
      </EMIPLayout>
    );
  }

  if (error) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-lg text-gray-900 mb-2">Error Loading BOMs</p>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={() => loadBOMs()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </EMIPLayout>
    );
  }

  return (
    <EMIPLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">BOM Repository</h1>
            <p className="text-gray-600 mt-1">Engineering Master Bill of Materials</p>
          </div>
          <div className="text-sm text-gray-500">
            {boms.length} Active BOMs
          </div>
        </div>

        {/* BOM List */}
        {boms.length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Part Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revision
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Components
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {boms.map((bom) => (
                  <tr key={bom.partNumber} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {bom.partNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                        {bom.revision}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {bom.recordCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-2">
                        {bom.hasArtifact && (
                          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
                            📄 PDF
                          </span>
                        )}
                        <span className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded">
                          📊 Structured
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(bom.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">🗂️</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No BOMs Found</h3>
            <p className="text-gray-500">Upload your first engineering master to get started</p>
          </div>
        )}
      </div>
    </EMIPLayout>
  );
}
