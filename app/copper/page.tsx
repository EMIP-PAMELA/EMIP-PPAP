'use client';

/**
 * V6.4.1 EMIP System Shell - Copper Index Page (Family Aggregation)
 * 
 * UI LAYER - Family Copper Index Display
 * 
 * Responsibilities:
 * - Display family-level copper aggregation
 * - Show calibration metrics (gross/copper/insulation)
 * - Enable family-based analysis
 * - Display SKU counts per family
 * 
 * Architecture:
 * - Consumes computeFamilyCopperIndex from bomService
 * - Pure display component
 * - No calculation logic
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import Link from 'next/link';
import { getAllActiveBOMs, getBOM, computeFamilyCopperIndex, type FamilyCopperIndex } from '@/src/core/services/bomService';

export default function CopperPage() {
  const [familyIndex, setFamilyIndex] = useState<Record<string, FamilyCopperIndex>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCopper, setTotalCopper] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [totalInsulation, setTotalInsulation] = useState(0);
  const [totalSKUs, setTotalSKUs] = useState(0);

  useEffect(() => {
    loadCopperData();
  }, []);

  const loadCopperData = async () => {
    try {
      // V6.4.1: Get all active BOMs first
      const activeBOMs = await getAllActiveBOMs();
      
      if (activeBOMs.length === 0) {
        setLoading(false);
        return;
      }

      // V6.4.1: Fetch BOM records for each active part number
      const allRecords = [];
      for (const bom of activeBOMs) {
        try {
          const records = await getBOM(bom.partNumber);
          allRecords.push(...records);
        } catch (err) {
          console.warn(`Skipping ${bom.partNumber}:`, err);
        }
      }

      // V6.4.1: Compute family copper index
      const index = computeFamilyCopperIndex(allRecords);
      
      // V6.4.1: Calculate totals
      let copper = 0;
      let gross = 0;
      let insulation = 0;
      let skus = 0;
      
      Object.values(index).forEach(family => {
        copper += family.totalCopper;
        gross += family.totalGross;
        insulation += family.totalInsulation;
        skus += family.skuCount;
      });
      
      setFamilyIndex(index);
      setTotalCopper(copper);
      setTotalGross(gross);
      setTotalInsulation(insulation);
      setTotalSKUs(skus);
      
      console.log('🧠 V6.4.1 UI LOADED', {
        familyCount: Object.keys(index).length,
        totalCopper: copper.toFixed(4),
        totalGross: gross.toFixed(4)
      });
      
      setLoading(false);
    } catch (err) {
      console.error('🧭 [Copper Page] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load copper data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-lg text-gray-600">Calculating copper usage...</p>
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
            <p className="text-lg text-gray-900 mb-2">Error Loading Copper Data</p>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={() => loadCopperData()}
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
            <h1 className="text-3xl font-bold text-gray-900">Copper Index</h1>
            <p className="text-gray-600 mt-1">Wire Weight Intelligence & Analytics</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600">Total Copper Weight</div>
            <div className="text-3xl font-bold text-orange-700">{totalCopper.toFixed(2)} lbs</div>
          </div>
        </div>

        {/* V6.4.1: Enhanced Summary Cards */}
        {Object.keys(familyIndex).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total Families</div>
              <div className="text-2xl font-bold text-gray-900">{Object.keys(familyIndex).length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total SKUs</div>
              <div className="text-2xl font-bold text-gray-900">{totalSKUs}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total Gross Weight</div>
              <div className="text-2xl font-bold text-gray-900">{totalGross.toFixed(3)} lbs</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total Insulation</div>
              <div className="text-2xl font-bold text-gray-900">{totalInsulation.toFixed(3)} lbs</div>
            </div>
          </div>
        )}

        {/* V6.4.1: Family Index Table */}
        {Object.keys(familyIndex).length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Family Copper Index</h2>
              <p className="text-sm text-gray-600 mt-1">Aggregated wire weight metrics by family</p>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Length
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Copper Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Insulation Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Weight
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.values(familyIndex)
                  .sort((a, b) => a.family.localeCompare(b.family))
                  .map((family) => (
                    <tr key={family.family} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">
                          {family.family}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                          {family.skuCount}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-blue-600 font-semibold">
                          {family.totalLength.toFixed(1)} ft
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-orange-600 font-semibold">
                          {family.totalCopper.toFixed(3)} lbs
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-green-600 font-semibold">
                          {family.totalInsulation.toFixed(3)} lbs
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-purple-600 font-semibold">
                          {family.totalGross.toFixed(3)} lbs
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No BOM Data Available</h3>
            <p className="text-gray-500">Upload BOMs to see family copper index</p>
          </div>
        )}
      </div>
    </EMIPLayout>
  );
}
