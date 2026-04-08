'use client';

/**
 * V6.0 EMIP System Shell - BOM Repository Page
 * 
 * UI LAYER - BOM List and Access
 * 
 * Responsibilities:
 * - Display active BOMs
 * - Provide access to raw artifacts
 * - Provide access to simplified projections
 * - Enable navigation to BOM details
 * 
 * Architecture:
 * - Consumes bomService for data
 * - Pure display component
 * - Links to artifact and projection views
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import Link from 'next/link';

interface BOMListItem {
  partNumber: string;
  revision: string;
  isActive: boolean;
  revisionOrder: number;
  recordCount: number;
  ingestionBatchId: string;
  hasArtifact: boolean;
  updatedAt: string;
}

export default function BOMPage() {
  const [boms, setBOMs] = useState<BOMListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBOMs();
  }, []);

  const loadBOMs = async () => {
    console.log('🧭 V6.0 [BOM Page] Loading BOMs', {
      timestamp: new Date().toISOString()
    });

    try {
      // TODO: Fetch from bomService
      // For now, mock data

      await new Promise(resolve => setTimeout(resolve, 500));

      setBOMs([
        {
          partNumber: 'NH123456789012',
          revision: 'B',
          isActive: true,
          revisionOrder: 2,
          recordCount: 150,
          ingestionBatchId: 'abc-123',
          hasArtifact: true,
          updatedAt: new Date().toISOString()
        },
        {
          partNumber: 'NH987654321098',
          revision: 'A',
          isActive: true,
          revisionOrder: 1,
          recordCount: 120,
          ingestionBatchId: 'def-456',
          hasArtifact: false,
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('🧭 [BOM Page] Error loading BOMs:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading BOMs...</div>
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
                  Status
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
                    <Link 
                      href={`/bom/${bom.partNumber}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {bom.partNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                      {bom.revision}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`
                      px-2 py-1 rounded text-xs font-medium
                      ${bom.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                    `}>
                      {bom.isActive ? 'Active' : 'Archived'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {bom.recordCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-2">
                      {bom.hasArtifact && (
                        <button className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100">
                          📄 PDF
                        </button>
                      )}
                      <button className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100">
                        📊 Structured
                      </button>
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

        {/* Empty State */}
        {boms.length === 0 && (
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
