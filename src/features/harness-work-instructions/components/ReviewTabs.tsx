/**
 * Harness Work Instruction Generator — Review UI Tabs
 * Phase HWI.0 — Scaffold Only
 */

'use client';

import React from 'react';

interface ReviewTabsProps {
  activeTab?: string;
}

export default function ReviewTabs({ activeTab = 'overview' }: ReviewTabsProps) {
  const tabs = ['Overview', 'Steps', 'Materials', 'Tooling'];

  return (
    <div className="review-tabs">
      <div className="flex gap-2 border-b border-gray-200 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.toLowerCase()
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="text-sm text-gray-500">Tab content will appear here (Scaffold)</div>
    </div>
  );
}
