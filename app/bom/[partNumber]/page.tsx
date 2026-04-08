'use client';

/**
 * V5.8 EMIP - BOM Detail Page
 * 
 * Interactive SKU detail view with structured BOM display
 * 
 * Responsibilities:
 * - Display BOM header (part number, revision, component count)
 * - List all components with details
 * - Sort by operation step
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EMIPLayout from '@/app/layout/EMIPLayout';
import { getBOMByPartNumber } from '@/src/core/services/bomService';
import { BOMRecord } from '@/src/core/data/bom/types';

interface BOMDetail {
  partNumber: string;
  revision: string;
  componentCount: number;
  components: BOMRecord[];
}

export default function BOMDetailPage() {
  const params = useParams();
  const router = useRouter();
  const partNumber = params.partNumber as string;
  
  const [bomDetail, setBOMDetail] = useState<BOMDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBOMDetail();
  }, [partNumber]);

  const loadBOMDetail = async () => {
    console.log('🧭 V5.8 [BOM Detail] Loading BOM', {
      partNumber,
      timestamp: new Date().toISOString()
    });

    try {
      const records = await getBOMByPartNumber(partNumber);
      
      if (records.length === 0) {
        setError('BOM not found');
        setLoading(false);
        return;
      }

      // V5.8.1: Sort components by operation_step (numeric sort)
      const sortedComponents = [...records].sort((a, b) => {
        const stepA = Number(a.operation_step ?? 0);
        const stepB = Number(b.operation_step ?? 0);
        return stepA - stepB;
      });

      const detail: BOMDetail = {
        partNumber: records[0].parent_part_number,
        revision: records[0].revision || 'A',
        componentCount: records.length,
        components: sortedComponents
      };

      setBOMDetail(detail);
      setLoading(false);
    } catch (err) {
      console.error('🧭 [BOM Detail] Error loading BOM:', err);
      setError(err instanceof Error ? err.message : 'Failed to load BOM');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-lg text-gray-600">Loading BOM...</p>
          </div>
        </div>
      </EMIPLayout>
    );
  }

  if (error || !bomDetail) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-lg text-gray-900 mb-2">BOM Not Found</p>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={() => router.push('/bom')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Back to BOM List
            </button>
          </div>
        </div>
      </EMIPLayout>
    );
  }

  return (
    <EMIPLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/bom')}
              className="text-sm text-blue-600 hover:text-blue-800 mb-2 flex items-center gap-1"
            >
              ← Back to BOM List
            </button>
            <h1 className="text-3xl font-bold text-gray-900">
              {bomDetail.partNumber}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="px-3 py-1 bg-gray-100 rounded text-sm font-medium">
                Revision {bomDetail.revision}
              </span>
              <span className="text-sm text-gray-600">
                {bomDetail.componentCount} Components
              </span>
            </div>
          </div>
        </div>

        {/* Components Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Bill of Materials</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Step
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Component Part Number
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Length
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gauge
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bomDetail.components.map((component, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {component.operation_step || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {component.component_part_number}
                      </div>
                      {component.description && (
                        <div className="text-xs text-gray-500 mt-1">
                          {component.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {component.quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {component.length ? `${component.length}` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {component.gauge || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {component.color || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {component.unit || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </EMIPLayout>
  );
}
