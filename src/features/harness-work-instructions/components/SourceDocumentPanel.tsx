/**
 * Harness Work Instruction Generator — Source Document Viewer
 * Phase HWI.0 — Scaffold Only
 */

'use client';

import React from 'react';

interface SourceDocumentPanelProps {
  documentUrl?: string;
}

export default function SourceDocumentPanel({ documentUrl }: SourceDocumentPanelProps) {
  return (
    <div className="source-document-panel p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="text-sm text-gray-500">Source Document Panel (Scaffold)</div>
      {documentUrl ? (
        <div className="text-xs font-mono mt-2">{documentUrl}</div>
      ) : (
        <div className="text-xs text-gray-400 mt-2">No document uploaded</div>
      )}
    </div>
  );
}
