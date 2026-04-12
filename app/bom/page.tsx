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

import React, { useEffect, useMemo, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import Link from 'next/link';
import { getAllActiveBOMs } from '@/src/core/services/bomService';
import BOMUpload from './components/BOMUpload';
import RevisionStatusBadge from '@/src/features/revision/components/RevisionStatusBadge';
import { useRevisionValidationMap } from '@/src/features/revision/hooks/useRevisionValidationMap';

interface BOMListItem {
  partNumber: string;
  revision: string;
  revisionOrder: number;
  recordCount: number;
  ingestionBatchId: string;
  hasArtifact: boolean;
  updatedAt: string;
  family: string | null;
}

interface FamilyGroup {
  family: string;
  items: BOMListItem[];
}

export default function BOMPage() {
  const [boms, setBOMs] = useState<BOMListItem[]>([]);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const partNumbers = useMemo(() => boms.map(b => b.partNumber?.trim().toUpperCase() ?? ''), [boms]);
  const { validationMap, pending } = useRevisionValidationMap(partNumbers);

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
      
      // V6.1.3: Group by family
      const grouped = data.reduce((acc, bom) => {
        const familyKey = bom.family || 'UNKNOWN';
        
        if (!acc[familyKey]) {
          acc[familyKey] = {
            family: familyKey,
            items: []
          };
        }
        
        acc[familyKey].items.push(bom);
        return acc;
      }, {} as Record<string, FamilyGroup>);
      
      // Convert to array and sort items within each family
      const groupedArray = Object.values(grouped).map(group => ({
        ...group,
        items: group.items.sort((a, b) => 
          a.partNumber.localeCompare(b.partNumber)
        )
      }));
      
      // Sort families by family number
      groupedArray.sort((a, b) => a.family.localeCompare(b.family));
      
      setFamilyGroups(groupedArray);
      
      // V6.1.3: Auto-expand all families by default
      setExpandedFamilies(new Set(groupedArray.map(g => g.family)));
      
      console.log('🧠 V6.1.3 FAMILY GROUPING', {
        totalBOMs: data.length,
        families: groupedArray.length,
        groups: groupedArray.map(g => ({
          family: g.family,
          count: g.items.length
        }))
      });
      
      setLoading(false);
    } catch (err) {
      console.error('� [BOM Page] Error loading BOMs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load BOMs');
      setLoading(false);
    }
  };
  
  const toggleFamily = (family: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(family)) {
        next.delete(family);
      } else {
        next.add(family);
      }
      return next;
    });
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

  const handleUploadSuccess = () => {
    console.log('📥 V5.5 [BOM Page] Upload successful, refreshing list');
    loadBOMs(); // Refresh the BOM list
  };

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

        {/* Upload Component */}
        <BOMUpload onUploadSuccess={handleUploadSuccess} />

        {/* BOM List - V6.1.3: Family Grouped */}
        {familyGroups.length > 0 ? (
          <div className="space-y-4">
            {familyGroups.map((group) => {
              const isExpanded = expandedFamilies.has(group.family);
              
              return (
                <div key={group.family} className="bg-white rounded-lg shadow overflow-hidden">
                  {/* Family Header */}
                  <button
                    onClick={() => toggleFamily(group.family)}
                    className="w-full px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <div className="text-left">
                        <h3 className="text-lg font-semibold text-gray-900">
                          Family {group.family}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {group.items.length} {group.items.length === 1 ? 'BOM' : 'BOMs'}
                        </p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Family BOMs */}
                  {isExpanded && (
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
                        {group.items.map((bom) => (
                          <tr key={bom.partNumber} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <Link 
                                href={`/bom/${encodeURIComponent(bom.partNumber)}`}
                                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {bom.partNumber}
                              </Link>
                              <div className="mt-1">
                                <RevisionStatusBadge
                                  status={validationMap[bom.partNumber.trim().toUpperCase()]?.status ?? undefined}
                                  showLabel={false}
                                  loading={pending.has(bom.partNumber.trim().toUpperCase())}
                                />
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
                  )}
                </div>
              );
            })}
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
