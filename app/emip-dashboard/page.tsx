'use client';

/**
 * V6.1 EMIP System Shell - Dashboard Page (Real Service Integration)
 * 
 * UI LAYER - System Overview and Entry Point
 * 
 * Responsibilities:
 * - Display work queue with real data
 * - Show active system metrics from services
 * - Show recent activity
 * - Provide quick navigation
 * 
 * Architecture:
 * - Consumes bomService, copperService for real data
 * - Pure orchestration and display
 * - Client-side data fetching
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import WorkQueue, { WorkQueueItem } from '../work-queue/WorkQueue';
import { getAllActiveBOMs } from '@/src/core/services/bomService';
import { getCopperUsageAcrossParts } from '@/src/features/copper-index/services/copperService';

interface DashboardStats {
  activeBOMs: number;
  totalCopperWeight: number;
  totalComponents: number;
}

export default function EMIPDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeBOMs: 0,
    totalCopperWeight: 0,
    totalComponents: 0
  });

  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    console.log('🧭 V6.1 DASHBOARD LOAD', {
      timestamp: new Date().toISOString()
    });

    try {
      // Fetch real data from services
      const boms = await getAllActiveBOMs();
      
      // Calculate stats
      const activeBOMCount = boms.length;
      const totalComponents = boms.reduce((sum, bom) => sum + bom.recordCount, 0);
      
      // Get copper data for all active parts
      let totalCopper = 0;
      try {
        const partNumbers = boms.map(b => b.partNumber);
        if (partNumbers.length > 0) {
          const copperAgg = await getCopperUsageAcrossParts(partNumbers);
          totalCopper = copperAgg.totalCopperWeight;
        }
      } catch (copperError) {
        console.warn('🧭 [Dashboard] Copper data unavailable:', copperError);
        // Continue without copper data
      }

      setStats({
        activeBOMs: activeBOMCount,
        totalCopperWeight: totalCopper,
        totalComponents
      });

      // Build work queue from real BOM data
      const queue: WorkQueueItem[] = boms.slice(0, 5).map(bom => ({
        id: bom.partNumber,
        type: 'BOM' as const,
        title: `${bom.partNumber} - Rev ${bom.revision}`,
        status: 'Active',
        nextAction: 'Review',
        link: `/bom/${bom.partNumber}`,
        updatedAt: bom.updatedAt
      }));

      setWorkQueueItems(queue);

      console.log('🧭 V6.1 DASHBOARD REAL DATA', {
        activeBOMs: activeBOMCount,
        totalComponents,
        copperLoaded: totalCopper > 0,
        timestamp: new Date().toISOString()
      });

      setLoading(false);
    } catch (err) {
      console.error('🧭 [Dashboard] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-lg text-gray-600">Loading dashboard...</p>
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
            <p className="text-lg text-gray-900 mb-2">Error Loading Dashboard</p>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={() => loadDashboardData()}
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
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to EMIP - Engineering Master Intelligence Platform</p>
        </div>

        {/* System Snapshot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active BOMs</p>
                <p className="text-3xl font-bold text-green-600">{stats.activeBOMs}</p>
              </div>
              <div className="text-4xl">🗂️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Components</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalComponents}</p>
              </div>
              <div className="text-4xl">📦</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Copper (lbs)</p>
                <p className="text-3xl font-bold text-orange-600">
                  {stats.totalCopperWeight > 0 ? stats.totalCopperWeight.toFixed(1) : 'N/A'}
                </p>
              </div>
              <div className="text-4xl">🔧</div>
            </div>
          </div>
        </div>

        {/* Work Queue Section */}
        <div className="grid grid-cols-1 gap-6">
          <WorkQueue 
            items={workQueueItems}
            title="Recent BOMs"
            emptyMessage="No BOMs in system. Upload your first engineering master to get started."
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a
              href="/ppap"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-2xl mb-2">📋</div>
              <div className="font-medium text-gray-900">PPAP Workflow</div>
              <div className="text-sm text-gray-600">Manage PPAP documentation</div>
            </a>
            <a
              href="/bom"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-2xl mb-2">🗂️</div>
              <div className="font-medium text-gray-900">BOM Repository</div>
              <div className="text-sm text-gray-600">Browse engineering masters</div>
            </a>
            <a
              href="/copper"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="text-2xl mb-2">🔧</div>
              <div className="font-medium text-gray-900">Copper Analysis</div>
              <div className="text-sm text-gray-600">View wire weight calculations</div>
            </a>
          </div>
        </div>
      </div>
    </EMIPLayout>
  );
}
