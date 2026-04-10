/**
 * Harness Work Instruction Generator — Job History Panel
 * Phase HWI.5 — Approval Workflow + Persistence
 *
 * Modal overlay listing all approved versions of a part number.
 * Each row shows version, revision, approver, date, and a PDF download link.
 */

'use client';

import React, { useEffect, useState } from 'react';
import type { JobListItem } from '../services/jobService';

interface JobHistoryPanelProps {
  partNumber: string;
  onClose: () => void;
}

export default function JobHistoryPanel({ partNumber, onClose }: JobHistoryPanelProps) {
  const [jobs, setJobs]       = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/harness-instructions/list-jobs?part_number=${encodeURIComponent(partNumber)}`)
      .then(r => r.json())
      .then((json: { ok: boolean; jobs?: JobListItem[]; error?: string }) => {
        if (json.ok && json.jobs) {
          setJobs(json.jobs);
        } else {
          setError(json.error ?? 'Failed to load history');
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [partNumber]);

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <div className="font-semibold text-gray-800">Approval History</div>
            <div className="text-xs text-gray-400 mt-0.5 font-mono">{partNumber}</div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-light leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm animate-pulse">
              Loading history...
            </div>
          )}

          {error && (
            <div className="p-5 text-sm text-red-600 bg-red-50">
              {error}
            </div>
          )}

          {!loading && !error && jobs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-gray-400">
              <div className="text-2xl mb-2">📋</div>
              <div className="text-sm">No approved versions yet</div>
            </div>
          )}

          {!loading && !error && jobs.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-gray-50">
                <tr>
                  {['Version', 'Revision', 'Approved By', 'Approved At', 'Status', 'PDF'].map(h => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600 border-b border-gray-200"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr
                    key={job.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-block bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded">
                        v{job.version}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      Rev {job.revision}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-600">
                      {job.approved_by ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {formatDate(job.approved_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {job.artifact_url ? (
                        <a
                          href={job.artifact_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                        >
                          📄 {job.file_name ?? 'Download PDF'}
                        </a>
                      ) : (
                        <span className="text-xs text-gray-300">No artifact</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
