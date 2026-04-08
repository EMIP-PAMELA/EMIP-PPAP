'use client';

/**
 * V6.0 EMIP System Shell - Dashboard Page
 * 
 * UI LAYER - System Overview and Entry Point
 * 
 * Responsibilities:
 * - Display work queue
 * - Show active PPAPs summary
 * - Show system metrics
 * - Show recent activity
 * - Provide quick navigation
 * 
 * Architecture:
 * - Consumes existing services (no new logic)
 * - Pure orchestration and display
 * - Client-side data fetching
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import WorkQueue, { WorkQueueItem } from '../work-queue/WorkQueue';

interface DashboardStats {
  activePPAPs: number;
  totalBOMs: number;
  totalCopperWeight: number;
  ppapsByPhase: {
    initiation: number;
    documentation: number;
    validation: number;
    submission: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activePPAPs: 0,
    totalBOMs: 0,
    totalCopperWeight: 0,
    ppapsByPhase: {
      initiation: 0,
      documentation: 0,
      validation: 0,
      submission: 0
    }
  });

  const [workQueueItems, setWorkQueueItems] = useState<WorkQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    console.log('🧭 V6.0 DASHBOARD LOAD', {
      timestamp: new Date().toISOString()
    });

    try {
      // TODO: Fetch real data from services
      // For now, use placeholder data to demonstrate UI

      // Simulate loading
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock data - replace with real service calls
      setStats({
        activePPAPs: 12,
        totalBOMs: 48,
        totalCopperWeight: 125.5,
        ppapsByPhase: {
          initiation: 3,
          documentation: 5,
          validation: 2,
          submission: 2
        }
      });

      // Mock work queue items
      setWorkQueueItems([
        {
          id: '1',
          type: 'PPAP',
          title: 'NH123456789012 - Rev B Documentation',
          status: 'In Progress',
          nextAction: 'Upload BOM',
          link: '/ppap/1',
          priority: 'high',
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          type: 'BOM',
          title: 'NH987654321098 - Rev A Validation',
          status: 'Pending Review',
          nextAction: 'Verify revision',
          link: '/bom/NH987654321098',
          priority: 'medium',
          updatedAt: new Date(Date.now() - 86400000).toISOString()
        }
      ]);

      setLoading(false);
    } catch (error) {
      console.error('🧭 [Dashboard] Error loading data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading dashboard...</div>
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
                <p className="text-sm text-gray-600">Active PPAPs</p>
                <p className="text-3xl font-bold text-blue-600">{stats.activePPAPs}</p>
              </div>
              <div className="text-4xl">📋</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active BOMs</p>
                <p className="text-3xl font-bold text-green-600">{stats.totalBOMs}</p>
              </div>
              <div className="text-4xl">🗂️</div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Copper (lbs)</p>
                <p className="text-3xl font-bold text-orange-600">{stats.totalCopperWeight.toFixed(1)}</p>
              </div>
              <div className="text-4xl">🔧</div>
            </div>
          </div>
        </div>

        {/* Work Queue Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <WorkQueue 
              items={workQueueItems}
              title="My Work"
              emptyMessage="No items assigned to you"
            />
          </div>

          {/* Active PPAPs Breakdown */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Active PPAPs by Phase</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Initiation</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${(stats.ppapsByPhase.initiation / stats.activePPAPs) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900 w-8 text-right">
                    {stats.ppapsByPhase.initiation}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">Documentation</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${(stats.ppapsByPhase.documentation / stats.activePPAPs) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900 w-8 text-right">
                    {stats.ppapsByPhase.documentation}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">Validation</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-500 h-2 rounded-full" 
                      style={{ width: `${(stats.ppapsByPhase.validation / stats.activePPAPs) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900 w-8 text-right">
                    {stats.ppapsByPhase.validation}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-700">Submission</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ width: `${(stats.ppapsByPhase.submission / stats.activePPAPs) * 100}%` }}
                    />
                  </div>
                  <span className="font-semibold text-gray-900 w-8 text-right">
                    {stats.ppapsByPhase.submission}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
          </div>
          <div className="p-6">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 text-gray-600">
                <span className="text-blue-500">●</span>
                <span>PPAP NH123456789012 created</span>
                <span className="text-gray-400">2 hours ago</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <span className="text-green-500">●</span>
                <span>BOM NH987654321098 Rev B uploaded</span>
                <span className="text-gray-400">5 hours ago</span>
              </div>
              <div className="flex items-center gap-3 text-gray-600">
                <span className="text-orange-500">●</span>
                <span>Copper analysis completed for 3 SKUs</span>
                <span className="text-gray-400">1 day ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </EMIPLayout>
  );
}
