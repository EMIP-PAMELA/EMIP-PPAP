/**
 * Harness Work Instruction Generator — Main Layout Shell
 * Phase HWI.0 — Scaffold Only
 */

'use client';

import React from 'react';

interface HarnessInstructionShellProps {
  children: React.ReactNode;
}

export default function HarnessInstructionShell({ children }: HarnessInstructionShellProps) {
  return (
    <div className="harness-instruction-shell">
      {children}
    </div>
  );
}
