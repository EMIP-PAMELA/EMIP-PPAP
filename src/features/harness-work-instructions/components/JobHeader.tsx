/**
 * Harness Work Instruction Generator — Job Header Component
 * Phase HWI.0 — Scaffold Only
 */

'use client';

import React from 'react';

interface JobHeaderProps {
  partNumber?: string;
  revision?: string;
  status?: string;
}

export default function JobHeader({ partNumber, revision, status }: JobHeaderProps) {
  return (
    <div className="job-header p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-sm text-gray-500">Job Header (Scaffold)</div>
      {partNumber && <div className="font-mono text-xs">{partNumber}</div>}
      {revision && <div className="text-xs">Rev: {revision}</div>}
      {status && <div className="text-xs">Status: {status}</div>}
    </div>
  );
}
