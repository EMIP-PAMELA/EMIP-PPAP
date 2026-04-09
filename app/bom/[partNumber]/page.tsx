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
import { getBOMByPartNumber, getAvailableRevisions, getBOMByPartAndRevision, computeSKUInsights, SKUInsights } from '@/src/core/services/bomService';
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

// Phase 3H.15.1: Number formatting helper for clean display
function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? value.toString()
    : value.toFixed(2);
}

// Phase 3H.15.2: Color-to-UI mapping for visual color coding
// Phase 3H.15.3: Enhanced white visibility with border
const COLOR_UI_MAP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  yellow: 'bg-yellow-400',
  green: 'bg-green-500',
  black: 'bg-gray-900',
  white: 'bg-white border-2 border-gray-600',  // Phase 3H.15.3: Critical fix for visibility
  orange: 'bg-orange-500',
  violet: 'bg-purple-500',
  purple: 'bg-purple-500',
  brown: 'bg-amber-700',
  gray: 'bg-gray-400',
  grey: 'bg-gray-400',
  pink: 'bg-pink-500',
  tan: 'bg-amber-600',
  gold: 'bg-yellow-600',
  silver: 'bg-gray-300',
  unknown: 'bg-gray-400'
};

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
  
  // V6.1: SKU Intelligence state
  const [skuInsights, setSKUInsights] = useState<SKUInsights | null>(null);
  
  // Phase 3H.15: Validation view mode
  const [viewMode, setViewMode] = useState<'standard' | 'validation'>('standard');
  const [sourceArtifactUrl, setSourceArtifactUrl] = useState<string | null>(null);

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

      // V6.1: Compute SKU Intelligence
      const insights = computeSKUInsights(records);
      setSKUInsights(insights);
      
      // Phase 3H.15: Extract source artifact URL from first record
      const artifactUrl = records[0]?.artifact_url || null;
      setSourceArtifactUrl(artifactUrl);
      
      console.log('🧠 V6.1 SKU INTELLIGENCE', {
        partNumber: detail.partNumber,
        totalComponents: insights.totalComponents,
        wireCount: insights.wireCount,
        totalWireLength: insights.totalWireLength,
        estimatedCopperWeight: insights.estimatedCopperWeight
      });

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
        {/* Phase 3H.15: View Mode Toggle */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">View Mode:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('standard')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  viewMode === 'standard'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Standard
              </button>
              <button
                onClick={() => setViewMode('validation')}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  viewMode === 'validation'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Validation
              </button>
            </div>
            {viewMode === 'validation' && (
              <span className="ml-auto text-xs text-gray-500 italic">
                Use this view to compare the original engineering master against extracted BOM data for verification.
              </span>
            )}
          </div>
        </div>

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

        {/* Phase 3H.15: Conditional rendering based on view mode */}
        {viewMode === 'standard' && (
          <>
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

        {/* V6.1: SKU Intelligence Section */}
        {skuInsights && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">SKU Intelligence</h2>
            
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Components</div>
                <div className="text-2xl font-bold text-gray-900">{skuInsights.totalComponents}</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Quantity</div>
                <div className="text-2xl font-bold text-gray-900">{skuInsights.totalQuantity}</div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">Wire Types</div>
                <div className="text-2xl font-bold text-blue-900">{skuInsights.wireCount}</div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">Total Wire Length</div>
                <div className="text-2xl font-bold text-blue-900">{skuInsights.totalWireLength.toFixed(1)}"</div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-xs text-blue-600 uppercase tracking-wide mb-1">Avg Wire Length</div>
                <div className="text-2xl font-bold text-blue-900">{skuInsights.avgWireLength.toFixed(1)}"</div>
              </div>
              
              <div className="bg-amber-50 p-4 rounded">
                <div className="text-xs text-amber-600 uppercase tracking-wide mb-1">Copper Weight</div>
                <div className="text-2xl font-bold text-amber-900">{skuInsights.estimatedCopperWeight.toFixed(3)} lbs</div>
              </div>
            </div>
            
            {/* V6.4.1: Calibration Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded">
                <div className="text-xs text-green-600 uppercase tracking-wide mb-1">Insulation Weight</div>
                <div className="text-2xl font-bold text-green-900">{skuInsights.estimatedInsulationWeight.toFixed(3)} lbs</div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-xs text-purple-600 uppercase tracking-wide mb-1">Gross Weight</div>
                <div className="text-2xl font-bold text-purple-900">{skuInsights.estimatedGrossWeight.toFixed(3)} lbs</div>
              </div>
              
              <div className="bg-amber-50 p-4 rounded">
                <div className="text-xs text-amber-600 uppercase tracking-wide mb-1">Copper %</div>
                <div className="text-2xl font-bold text-amber-900">{(skuInsights.copperPercent * 100).toFixed(1)}%</div>
              </div>
              
              <div className="bg-green-50 p-4 rounded">
                <div className="text-xs text-green-600 uppercase tracking-wide mb-1">Insulation %</div>
                <div className="text-2xl font-bold text-green-900">{(skuInsights.insulationPercent * 100).toFixed(1)}%</div>
              </div>
              
              <div className="bg-gray-50 p-4 rounded">
                <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Unit Source</div>
                <div className="text-sm font-bold text-gray-900">{skuInsights.lengthUnit}</div>
              </div>
            </div>
            
            {/* Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Gauge Distribution */}
              {Object.keys(skuInsights.gaugeBreakdown).length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Gauge Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(skuInsights.gaugeBreakdown)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([gauge, count]) => {
                        const percentage = (count / skuInsights.wireCount) * 100;
                        return (
                          <div key={gauge} className="grid grid-cols-[120px_1fr_80px] items-center gap-3 py-1">
                            <div className="text-sm font-medium text-gray-700">
                              AWG {gauge}
                            </div>
                            <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
                              <div
                                className="bg-blue-500 h-3 rounded"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="text-sm text-gray-800 text-right tabular-nums">
                              {formatNumber(count)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Gauge Distribution</h3>
                  <div className="text-sm text-gray-500">No data available.</div>
                </div>
              )}
              
              {/* Color Distribution */}
              {Object.keys(skuInsights.colorBreakdown).length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Color Distribution</h3>
                  <div className="space-y-2">
                    {(() => {
                      // Phase 3H.15.2: Calculate max value for proportional scaling
                      const colorEntries = Object.entries(skuInsights.colorBreakdown);
                      const maxValue = Math.max(...colorEntries.map(([, count]) => count));
                      
                      // Sort by count descending, but keep UNKNOWN last
                      const sortedEntries = colorEntries.sort(([colorA, countA], [colorB, countB]) => {
                        const isUnknownA = colorA.toLowerCase().includes('unknown');
                        const isUnknownB = colorB.toLowerCase().includes('unknown');
                        if (isUnknownA && !isUnknownB) return 1;
                        if (!isUnknownA && isUnknownB) return -1;
                        return countB - countA;
                      });
                      
                      return sortedEntries.map(([colorKey, count]) => {
                        // Phase 3H.15.4: colorKey is ALREADY normalized from colorBreakdown (uses colorNormalized)
                        // No need to call normalizeWireColor again - data is already normalized!
                        const displayLabel = colorKey.toUpperCase();
                        const percentage = (count / maxValue) * 100;
                        const colorClass = COLOR_UI_MAP[colorKey.toLowerCase()] || COLOR_UI_MAP.unknown;
                        
                        return (
                          <div key={colorKey} className="grid grid-cols-[120px_1fr_80px] items-center gap-3 py-1">
                            <div className="text-sm font-medium text-gray-700">
                              {displayLabel}
                            </div>
                            <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
                              <div
                                className={`h-3 rounded ${colorClass}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="text-sm text-gray-800 text-right tabular-nums">
                              {formatNumber(count)}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Color Distribution</h3>
                  <div className="text-sm text-gray-500">No data available.</div>
                </div>
              )}
              
              {/* Operation Step Distribution */}
              {Object.keys(skuInsights.operationStepDistribution).length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Operation Distribution</h3>
                  <div className="space-y-2">
                    {Object.entries(skuInsights.operationStepDistribution)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([step, count]) => {
                        const percentage = (count / skuInsights.totalComponents) * 100;
                        return (
                          <div key={step} className="grid grid-cols-[120px_1fr_80px] items-center gap-3 py-1">
                            <div className="text-sm font-medium text-gray-700">
                              Step {step}
                            </div>
                            <div className="w-full bg-gray-200 rounded h-3 overflow-hidden">
                              <div
                                className="bg-purple-500 h-3 rounded"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <div className="text-sm text-gray-800 text-right tabular-nums">
                              {formatNumber(count)}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Operation Distribution</h3>
                  <div className="text-sm text-gray-500">No data available.</div>
                </div>
              )}
            </div>
            
            {/* No wire data message */}
            {skuInsights.wireCount === 0 && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
                No wire components detected in this BOM.
              </div>
            )}
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
                    Category
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* Phase 3H.15.6: Use category from DB directly - no fallback */}
                      {component.category === 'UNKNOWN' || !component.category ? (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                          {component.category || 'UNKNOWN'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                          {component.category}
                        </span>
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
                      {/* Phase 3H.15.6: Use normalizedColor from DB as single source of truth */}
                      {(component.normalizedColor || component.color) ? (
                        <span title={`Raw: ${component.rawColor || component.color || 'N/A'}`} className="cursor-help">
                          {(component.normalizedColor || component.color)?.toUpperCase()}
                        </span>
                      ) : (
                        '-'
                      )}
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
          </>
        )}

        {/* Phase 3H.15: Validation View Mode */}
        {viewMode === 'validation' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LEFT PANEL: Source Document */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Source Document {bomDetail.revision && `— Revision ${bomDetail.revision}`}
                </h2>
              </div>
              <div className="p-6">
                {sourceArtifactUrl ? (
                  <div className="space-y-4">
                    <div className="aspect-[8.5/11] bg-gray-100 rounded border border-gray-300 overflow-hidden">
                      <iframe
                        src={sourceArtifactUrl}
                        className="w-full h-full"
                        title="Source BOM Document"
                      />
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={sourceArtifactUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        Open in New Tab
                      </a>
                      <a
                        href={sourceArtifactUrl}
                        download
                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300 transition-colors"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-gray-400 mb-2">
                      <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">Source document not available for this BOM.</p>
                    <p className="text-gray-500 text-sm mt-1">The engineering master may not have been uploaded or linked.</p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Extracted Data */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Extracted Data</h2>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: '800px' }}>
                {/* Extracted Metadata Summary */}
                <div className="p-6 border-b border-gray-200 bg-blue-50">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Part Number</div>
                      <div className="text-sm font-semibold text-gray-900">{bomDetail.partNumber}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Revision</div>
                      <div className="text-sm font-semibold text-gray-900">{bomDetail.revision}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Parsed Components</div>
                      <div className="text-sm font-semibold text-gray-900">{bomDetail.componentCount}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Wires</div>
                      <div className="text-sm font-semibold text-gray-900">{skuInsights?.wireCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Connectors</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {bomDetail.components.filter(c => c.category === 'CONNECTOR').length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-600 uppercase tracking-wide mb-1">Unknowns</div>
                      <div className="text-sm font-semibold text-yellow-700">
                        {bomDetail.components.filter(c => c.category === 'UNKNOWN' || !c.category).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Extracted BOM Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Step</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Part Number</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Gauge</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Color</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                    {bomDetail.components.map((component, idx) => {
                      // Phase 3H.16.3: Debug log category flow from API to UI
                      if (idx === 0 || component.category) {
                        console.log(` UI CATEGORY: ${component.component_part_number} → ${component.category || 'NULL'}`);
                      }
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {component.operation_step || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">
                            {component.component_part_number}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            {component.category === 'UNKNOWN' || !component.category ? (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                                UNKNOWN
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-800">
                                {component.category}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 whitespace-nowrap">
                            {component.quantity}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {component.length || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {component.gauge || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-500 whitespace-nowrap">
                            {component.normalizedColor || component.color || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </EMIPLayout>
  );
}
