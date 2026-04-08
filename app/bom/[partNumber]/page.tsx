'use client';

/**
 * V6.0 EMIP - BOM Detail Page with Revision Comparison
 * 
 * Interactive SKU detail view with structured BOM display and revision diff
 * 
 * Responsibilities:
 * - Display BOM header (part number, revision, component count)
 * - List all components with details
 * - Sort by operation step
 * - V6.0: Compare two revisions and show added/removed/changed components
 */

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import EMIPLayout from '@/app/layout/EMIPLayout';
import { getBOMByPartNumber, getAvailableRevisions, getBOMByPartAndRevision } from '@/src/core/services/bomService';
import { BOMRecord } from '@/src/core/data/bom/types';
import { compareBOMRevisions, RevisionDiff } from '@/src/core/services/revisionComparisonService';

interface BOMDetail {
  partNumber: string;
  revision: string;
  componentCount: number;
  components: BOMRecord[];
}

interface RevisionInfo {
  revision: string;
  revisionOrder: number;
  recordCount: number;
  isActive: boolean;
  ingestionBatchId: string;
}

export default function BOMDetailPage() {
  const params = useParams();
  const router = useRouter();
  const partNumber = params.partNumber as string;
  
  const [bomDetail, setBOMDetail] = useState<BOMDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // V6.0: Revision comparison state
  const [availableRevisions, setAvailableRevisions] = useState<RevisionInfo[]>([]);
  const [fromRevision, setFromRevision] = useState<string>('');
  const [toRevision, setToRevision] = useState<string>('');
  const [diffResult, setDiffResult] = useState<RevisionDiff | null>(null);
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  useEffect(() => {
    loadBOMDetail();
    loadAvailableRevisions();
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

  // V6.0: Load available revisions for comparison
  const loadAvailableRevisions = async () => {
    try {
      const revisions = await getAvailableRevisions(partNumber);
      setAvailableRevisions(revisions);
      
      console.log('🧠 V6.0 [BOM Detail] Loaded revisions', {
        partNumber,
        count: revisions.length,
        revisions: revisions.map(r => r.revision)
      });
    } catch (err) {
      console.error('🧠 V6.0 [BOM Detail] Error loading revisions:', err);
    }
  };

  // V6.0: Compare two revisions
  const handleCompare = async () => {
    if (!fromRevision || !toRevision) {
      setCompareError('Please select both revisions to compare');
      return;
    }

    if (fromRevision === toRevision) {
      setCompareError('Please select two different revisions');
      return;
    }

    setComparing(true);
    setCompareError(null);

    try {
      console.log('🧠 V6.0 [BOM Detail] Comparing revisions', {
        partNumber,
        from: fromRevision,
        to: toRevision
      });

      const oldRecords = await getBOMByPartAndRevision(partNumber, fromRevision);
      const newRecords = await getBOMByPartAndRevision(partNumber, toRevision);

      const diff = compareBOMRevisions(
        partNumber,
        fromRevision,
        toRevision,
        oldRecords,
        newRecords
      );

      setDiffResult(diff);
      setComparing(false);
    } catch (err) {
      console.error('🧠 V6.0 [BOM Detail] Error comparing revisions:', err);
      setCompareError(err instanceof Error ? err.message : 'Failed to compare revisions');
      setComparing(false);
    }
  };

  // V6.0: Clear comparison
  const handleClearComparison = () => {
    setDiffResult(null);
    setFromRevision('');
    setToRevision('');
    setCompareError(null);
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

        {/* V6.0: Revision Comparison Section */}
        {availableRevisions.length > 1 && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revision Comparison</h2>
            
            <div className="flex items-end gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Revision
                </label>
                <select
                  value={fromRevision}
                  onChange={(e) => setFromRevision(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select revision...</option>
                  {availableRevisions.map((rev) => (
                    <option key={rev.revision} value={rev.revision}>
                      {rev.revision} {rev.isActive ? '(Active)' : ''} - {rev.recordCount} components
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Revision
                </label>
                <select
                  value={toRevision}
                  onChange={(e) => setToRevision(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select revision...</option>
                  {availableRevisions.map((rev) => (
                    <option key={rev.revision} value={rev.revision}>
                      {rev.revision} {rev.isActive ? '(Active)' : ''} - {rev.recordCount} components
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={handleCompare}
                disabled={comparing || !fromRevision || !toRevision}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {comparing ? 'Comparing...' : 'Compare'}
              </button>
              
              {diffResult && (
                <button
                  onClick={handleClearComparison}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>

            {compareError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {compareError}
              </div>
            )}

            {/* Diff Results */}
            {diffResult && (
              <div className="space-y-4 mt-6">
                {/* Summary */}
                <div className="bg-gray-50 p-4 rounded border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
                  <div className="text-sm text-gray-700 space-y-1">
                    {diffResult.humanSummary.map((line, idx) => (
                      <div key={idx}>• {line}</div>
                    ))}
                  </div>
                  <div className="mt-3 flex gap-4 text-sm">
                    {diffResult.summary.addedCount > 0 && (
                      <span className="text-green-700">+{diffResult.summary.addedCount} added</span>
                    )}
                    {diffResult.summary.removedCount > 0 && (
                      <span className="text-red-700">-{diffResult.summary.removedCount} removed</span>
                    )}
                    {diffResult.summary.changedCount > 0 && (
                      <span className="text-blue-700">~{diffResult.summary.changedCount} changed</span>
                    )}
                    {diffResult.summary.wireChangesCount > 0 && (
                      <span className="text-orange-700 font-semibold">⚡ {diffResult.summary.wireChangesCount} wire changes</span>
                    )}
                  </div>
                </div>

                {/* Added Items */}
                {diffResult.added.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-green-700 mb-2">Added Components ({diffResult.added.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-green-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Step</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Part Number</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Qty</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Length</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Gauge</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Color</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diffResult.added.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2">{item.operation_step || '-'}</td>
                              <td className="px-4 py-2 font-medium">{item.component_part_number}</td>
                              <td className="px-4 py-2">{item.quantity}</td>
                              <td className="px-4 py-2">{item.length || '-'}</td>
                              <td className="px-4 py-2">{item.gauge || '-'}</td>
                              <td className="px-4 py-2">{item.color || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Removed Items */}
                {diffResult.removed.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-red-700 mb-2">Removed Components ({diffResult.removed.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-red-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Step</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Part Number</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Qty</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Length</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Gauge</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Color</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {diffResult.removed.map((item, idx) => (
                            <tr key={idx}>
                              <td className="px-4 py-2">{item.operation_step || '-'}</td>
                              <td className="px-4 py-2 font-medium">{item.component_part_number}</td>
                              <td className="px-4 py-2">{item.quantity}</td>
                              <td className="px-4 py-2">{item.length || '-'}</td>
                              <td className="px-4 py-2">{item.gauge || '-'}</td>
                              <td className="px-4 py-2">{item.color || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Changed Items */}
                {diffResult.changed.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-blue-700 mb-2">Changed Components ({diffResult.changed.length})</h3>
                    <div className="space-y-2">
                      {diffResult.changed.map((change, idx) => (
                        <div key={idx} className="bg-blue-50 p-3 rounded border border-blue-200">
                          <div className="font-medium text-gray-900 mb-2">
                            {change.component_part_number}
                            {change.isWire && <span className="ml-2 text-orange-600 font-semibold">⚡ WIRE</span>}
                          </div>
                          <div className="space-y-1 text-sm">
                            {change.changes.quantity && (
                              <div className="text-gray-700">
                                <span className="font-medium">Quantity:</span> {change.changes.quantity.from} → {change.changes.quantity.to}
                              </div>
                            )}
                            {change.changes.length && (
                              <div className="text-gray-700">
                                <span className="font-medium">Length:</span> {change.changes.length.from || 'N/A'} → {change.changes.length.to || 'N/A'}
                              </div>
                            )}
                            {change.changes.gauge && (
                              <div className="text-gray-700">
                                <span className="font-medium">Gauge:</span> {change.changes.gauge.from || 'N/A'} → {change.changes.gauge.to || 'N/A'}
                              </div>
                            )}
                            {change.changes.color && (
                              <div className="text-gray-700">
                                <span className="font-medium">Color:</span> {change.changes.color.from || 'N/A'} → {change.changes.color.to || 'N/A'}
                              </div>
                            )}
                            {change.changes.operation_step && (
                              <div className="text-gray-700">
                                <span className="font-medium">Operation Step:</span> {change.changes.operation_step.from || 'N/A'} → {change.changes.operation_step.to || 'N/A'}
                              </div>
                            )}
                            {change.changes.unit && (
                              <div className="text-gray-700">
                                <span className="font-medium">Unit:</span> {change.changes.unit.from || 'N/A'} → {change.changes.unit.to || 'N/A'}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {availableRevisions.length === 1 && (
          <div className="bg-gray-50 p-4 rounded border border-gray-200 text-sm text-gray-600">
            Only one revision available. Upload another revision to enable comparison.
          </div>
        )}

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
