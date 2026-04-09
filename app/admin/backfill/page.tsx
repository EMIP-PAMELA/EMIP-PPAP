/**
 * Phase 3H.16.1: Admin Backfill Page
 * 
 * Provides UI for running classification backfill on BOM records
 */

'use client';

import React, { useState } from 'react';
import EMIPLayout from '@/app/layout/EMIPLayout';

interface BackfillResult {
  success: boolean;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  errors?: string[];
  duration: number;
}

export default function BackfillPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<BackfillResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Phase 3H.16.2: Manual trigger function for console testing
  React.useEffect(() => {
    (window as any).runBackfill = async () => {
      console.log('🔄 Manual backfill triggered from console');
      const res = await fetch('/api/admin/backfill', { method: 'POST' });
      const data = await res.json();
      console.log('📊 Backfill result:', data);
      return data;
    };
    console.log('💡 Manual trigger available: window.runBackfill()');
    return () => {
      delete (window as any).runBackfill;
    };
  }, []);

  const handleBackfill = async () => {
    if (!confirm('Are you sure you want to run the classification backfill? This will update all BOM records with missing or UNKNOWN categories.')) {
      return;
    }

    console.log('🔄 Starting backfill execution...');
    setIsRunning(true);
    setError(null);
    setResult(null);

    try {
      console.log('📡 Sending POST to /api/admin/backfill...');
      const response = await fetch('/api/admin/backfill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 Response status:', response.status);

      const data = await response.json();
      console.log('📊 Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Backfill failed');
      }

      console.log('✅ Backfill completed successfully');
      setResult(data);
    } catch (err) {
      console.error('❌ Backfill error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsRunning(false);
      console.log('🏁 Backfill execution finished');
    }
  };

  return (
    <EMIPLayout>
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Classification Backfill
          </h1>
          <p className="text-gray-600 mb-6">
            Phase 3H.16.1: Reclassify existing BOM records with enhanced pattern matching
          </p>

          {/* Warning Banner */}
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Admin Action Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>This operation will update all BOM records with:</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Missing or UNKNOWN categories → Reclassified using pattern matching</li>
                    <li>Missing normalizedColor → Populated from color field</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="mb-6">
            <button
              onClick={handleBackfill}
              disabled={isRunning}
              className={`px-6 py-3 rounded-lg font-semibold text-white transition-colors ${
                isRunning
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isRunning ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Running Backfill...
                </span>
              ) : (
                'Run Classification Backfill'
              )}
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Result Display */}
          {result && (
            <div className={`border-l-4 p-4 ${result.success ? 'bg-green-50 border-green-400' : 'bg-yellow-50 border-yellow-400'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className={`h-5 w-5 ${result.success ? 'text-green-400' : 'text-yellow-400'}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1">
                  <h3 className={`text-sm font-medium ${result.success ? 'text-green-800' : 'text-yellow-800'}`}>
                    Backfill Complete
                  </h3>
                  <div className="mt-2 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-semibold">Updated:</span> {result.updatedCount}
                      </div>
                      <div>
                        <span className="font-semibold">Skipped:</span> {result.skippedCount}
                      </div>
                      <div>
                        <span className="font-semibold">Errors:</span> {result.errorCount}
                      </div>
                      <div>
                        <span className="font-semibold">Duration:</span> {result.duration}ms
                      </div>
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-4">
                        <p className="font-semibold text-red-800">Errors:</p>
                        <ul className="list-disc list-inside mt-2 text-red-700">
                          {result.errors.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Section */}
          <div className="mt-8 bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">What This Does:</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li>• <strong>Wire Detection:</strong> Part numbers starting with W + digits → WIRE</li>
              <li>• <strong>Terminal Detection:</strong> SVH, SPH, or -T- in part number → TERMINAL</li>
              <li>• <strong>Connector Detection:</strong> VHR or JST in part number → CONNECTOR</li>
              <li>• <strong>Color Normalization:</strong> GR→green, BR→brown, WH→white, etc.</li>
            </ul>
          </div>
        </div>
      </div>
    </EMIPLayout>
  );
}
