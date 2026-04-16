/**
 * SharePoint Service — Phase T21
 *
 * Unified entry point for all SharePoint operations.
 * Mode is determined by the SHAREPOINT_MODE environment variable:
 *
 *   OFF   (default) — all calls throw immediately. No SharePoint dependency.
 *   LOCAL           — delegates to LocalSharePointAdapter (mock-sharepoint/).
 *   GRAPH           — delegates to GraphSharePointAdapter (stub, not yet implemented).
 *
 * Consumers must import from this file ONLY — never from adapters directly.
 * This preserves the ability to swap adapters without touching callsites.
 *
 * Governance:
 *   - OFF is the hard default. The system must function without any SharePoint config.
 *   - Mode is read once at import time (process.env.SHAREPOINT_MODE).
 *   - This service is side-effect-free at import time in OFF mode.
 *   - Never throws at import time — only throws at call time when mode is OFF or GRAPH.
 *
 * Usage example:
 *   import { getFile, uploadFile, listFiles } from '@/src/services/sharepoint/sharepointService';
 *   const buf = await getFile('EMIP/Drawings/doc.pdf');
 */

import type { SharePointAdapter } from './sharepointAdapter';

// ---------------------------------------------------------------------------
// Mode resolution
// ---------------------------------------------------------------------------

type SharePointMode = 'OFF' | 'LOCAL' | 'GRAPH';

const RAW_MODE = (process.env.SHAREPOINT_MODE ?? 'OFF').toUpperCase();
const MODE: SharePointMode =
  RAW_MODE === 'LOCAL' ? 'LOCAL' :
  RAW_MODE === 'GRAPH' ? 'GRAPH' :
  'OFF';

// ---------------------------------------------------------------------------
// Lazy adapter factory — avoids loading fs/node modules in GRAPH/OFF mode
// ---------------------------------------------------------------------------

let _adapter: SharePointAdapter | null = null;

function getAdapter(): SharePointAdapter {
  if (_adapter) return _adapter;

  if (MODE === 'OFF') {
    throw new Error(
      '[SharePointService] SharePoint is disabled (SHAREPOINT_MODE=OFF). ' +
      'Set SHAREPOINT_MODE=LOCAL to use the local mock adapter.',
    );
  }

  if (MODE === 'GRAPH') {
    const { GraphSharePointAdapter } = require('./graphSharePointAdapter') as typeof import('./graphSharePointAdapter');
    _adapter = new GraphSharePointAdapter();
    return _adapter;
  }

  // LOCAL
  const { LocalSharePointAdapter } = require('./localSharePointAdapter') as typeof import('./localSharePointAdapter');
  _adapter = new LocalSharePointAdapter();
  return _adapter;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve a file from SharePoint.
 * Throws when SHAREPOINT_MODE is OFF or GRAPH (stub).
 */
export async function getFile(path: string): Promise<Buffer> {
  return getAdapter().getFile(path);
}

/**
 * Upload a file to SharePoint.
 * Throws when SHAREPOINT_MODE is OFF or GRAPH (stub).
 */
export async function uploadFile(path: string, content: Buffer): Promise<void> {
  return getAdapter().uploadFile(path, content);
}

/**
 * List files within a SharePoint folder.
 * Throws when SHAREPOINT_MODE is OFF or GRAPH (stub).
 */
export async function listFiles(folder: string): Promise<string[]> {
  return getAdapter().listFiles(folder);
}

// ---------------------------------------------------------------------------
// Test utility
// ---------------------------------------------------------------------------

export interface SharePointConnectionInfo {
  mode:    SharePointMode;
  enabled: boolean;
  /** Accessible top-level paths (LOCAL only; undefined when OFF or GRAPH). */
  paths?:  string[];
  error?:  string;
}

/**
 * Probes the current SharePoint configuration and returns diagnostic info.
 * Safe to call in any mode — never throws.
 */
export async function testSharePointConnection(): Promise<SharePointConnectionInfo> {
  if (MODE === 'OFF') {
    return { mode: 'OFF', enabled: false };
  }

  if (MODE === 'GRAPH') {
    return {
      mode:    'GRAPH',
      enabled: false,
      error:   'Graph adapter not implemented yet',
    };
  }

  // LOCAL
  try {
    const root = await listFiles('');
    const emip = await listFiles('EMIP');
    return {
      mode:    'LOCAL',
      enabled: true,
      paths:   ['/', ...root.map(f => `/${f}`), ...emip.map(f => `/EMIP/${f}`)],
    };
  } catch (err: unknown) {
    return {
      mode:    'LOCAL',
      enabled: false,
      error:   err instanceof Error ? err.message : String(err),
    };
  }
}
