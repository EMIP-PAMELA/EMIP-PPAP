'use client';

/**
 * V6.0 EMIP System Shell - Copper Index Page
 * 
 * UI LAYER - Copper Analysis Results
 * 
 * Responsibilities:
 * - Display copper calculation results
 * - Show wire breakdown by gauge and color
 * - Enable multi-SKU comparisons
 * - Link to detailed analysis
 * 
 * Architecture:
 * - Consumes copperService for data
 * - Pure display component
 * - No calculation logic
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import Link from 'next/link';

interface CopperResultItem {
  partNumber: string;
  revision: string;
  totalCopperWeight: number;
  wireCount: number;
  topGauge: string;
  topColor: string;
}

export default function CopperPage() {
  const [results, setResults] = useState<CopperResultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCopper, setTotalCopper] = useState(0);

  useEffect(() => {
    loadCopperData();
  }, []);

  const loadCopperData = async () => {
    console.log('🧭 V6.0 [Copper Page] Loading copper data', {
      timestamp: new Date().toISOString()
    });

    try {
      // TODO: Fetch from copperService
      // For now, mock data

      await new Promise(resolve => setTimeout(resolve, 500));

      const mockResults = [
        {
          partNumber: 'NH123456789012',
          revision: 'B',
          totalCopperWeight: 2.45,
          wireCount: 8,
          topGauge: '18',
          topColor: 'red'
        },
        {
          partNumber: 'NH987654321098',
          revision: 'A',
          totalCopperWeight: 1.85,
          wireCount: 6,
          topGauge: '20',
          topColor: 'black'
        }
      ];

      setResults(mockResults);
      setTotalCopper(mockResults.reduce((sum, r) => sum + r.totalCopperWeight, 0));
      setLoading(false);
    } catch (error) {
      console.error('🧭 [Copper Page] Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading copper analysis...</div>
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Analyzed SKUs</div>
            <div className="text-2xl font-bold text-gray-900">{results.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Average Copper/SKU</div>
            <div className="text-2xl font-bold text-gray-900">
              {results.length > 0 ? (totalCopper / results.length).toFixed(2) : '0.00'} lbs
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600">Total Wire Types</div>
            <div className="text-2xl font-bold text-gray-900">
              {results.reduce((sum, r) => sum + r.wireCount, 0)}
            </div>
          </div>
        </div>

        {/* Results Table */}
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
                  Copper Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Wire Count
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Gauge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Top Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((result) => (
                <tr key={result.partNumber} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link 
                      href={`/copper/${result.partNumber}`}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {result.partNumber}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                      {result.revision}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-orange-600 font-semibold">
                      {result.totalCopperWeight.toFixed(2)} lbs
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {result.wireCount}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      {result.topGauge} AWG
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium capitalize">
                      {result.topColor}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link 
                      href={`/copper/${result.partNumber}`}
                      className="text-xs px-3 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {results.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Copper Analysis Available</h3>
            <p className="text-gray-500">Upload BOMs with wire data to see copper calculations</p>
          </div>
        )}
      </div>
    </EMIPLayout>
  );
}
