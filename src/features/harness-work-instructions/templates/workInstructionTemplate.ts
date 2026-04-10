/**
 * Harness Work Instruction Generator — HTML Template Renderer
 * Phase HWI.4 — PDF Generation
 *
 * Returns a complete, self-contained HTML string that Puppeteer renders
 * to PDF. Uses only inline CSS — no external dependencies.
 *
 * Page 1: Komax Program + Manual Press Operations + Notes
 * Page 2: Pin Map + Assembly Steps + Engineering Notes
 */

import type { TemplateData } from '../services/instructionTemplateData';
import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';
import { buildTemplateData } from '../services/instructionTemplateData';

// ---------------------------------------------------------------------------
// CSS (inline, print-safe)
// ---------------------------------------------------------------------------

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    background: white;
  }
  .page {
    padding: 0.5in;
    min-height: 10.5in;
    position: relative;
  }
  .page-break { page-break-before: always; }

  /* ---- Header ---- */
  .doc-header {
    border-bottom: 2.5px solid #1a3a6b;
    padding-bottom: 8px;
    margin-bottom: 16px;
  }
  .doc-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .doc-title {
    font-size: 13pt;
    font-weight: bold;
    color: #1a3a6b;
    letter-spacing: 0.03em;
  }
  .doc-company {
    font-size: 8pt;
    color: #718096;
    margin-top: 2px;
  }
  .doc-meta {
    text-align: right;
  }
  .doc-pn {
    font-size: 12pt;
    font-weight: bold;
    font-family: 'Courier New', Courier, monospace;
    color: #1a3a6b;
  }
  .doc-rev {
    font-size: 9pt;
    color: #4a5568;
    margin-top: 2px;
  }
  .doc-date {
    font-size: 7.5pt;
    color: #a0aec0;
    margin-top: 2px;
  }

  /* ---- Sections ---- */
  .section { margin-bottom: 20px; }
  .section-title {
    font-size: 9.5pt;
    font-weight: bold;
    color: white;
    background: #1a3a6b;
    padding: 5px 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .section-empty {
    font-size: 8.5pt;
    color: #a0aec0;
    padding: 8px;
    border: 1px solid #e2e8f0;
    text-align: center;
  }

  /* ---- Tables ---- */
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 8.5pt;
  }
  thead tr { background: #2c5282; }
  th {
    padding: 5px 7px;
    text-align: left;
    font-weight: 600;
    color: white;
    font-size: 8pt;
    border-right: 1px solid #3a6298;
    white-space: nowrap;
  }
  th:last-child { border-right: none; }
  td {
    padding: 4px 7px;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #edf2f7;
    vertical-align: top;
  }
  td:last-child { border-right: none; }
  tr:nth-child(even) td { background: #f7fafc; }
  tr:nth-child(odd) td  { background: #ffffff; }
  .mono { font-family: 'Courier New', Courier, monospace; font-size: 8pt; }
  .aci  { font-weight: bold; color: #1a3a6b; }
  .dim  { color: #718096; font-size: 7.5pt; }
  .center { text-align: center; }

  /* ---- Assembly Steps ---- */
  .steps-list { padding: 8px 0; }
  .step-item {
    display: flex;
    gap: 10px;
    padding: 6px 8px;
    border-bottom: 1px solid #edf2f7;
  }
  .step-item:nth-child(even) { background: #f7fafc; }
  .step-num {
    min-width: 22px;
    font-weight: bold;
    color: #2c5282;
    font-size: 9pt;
    flex-shrink: 0;
  }
  .step-body { flex: 1; }
  .step-instruction { font-size: 9pt; color: #1a1a1a; line-height: 1.4; }
  .step-meta { font-size: 7.5pt; color: #718096; margin-top: 2px; }

  /* ---- Engineering Flags ---- */
  .flags-list { padding: 4px 0; }
  .flag-item {
    display: flex;
    gap: 8px;
    padding: 4px 8px;
    border-bottom: 1px solid #fed7d7;
    background: #fff5f5;
  }
  .flag-item:last-child { border-bottom: none; }
  .flag-id { font-family: 'Courier New', monospace; font-size: 7.5pt; color: #c53030; min-width: 80px; flex-shrink: 0; }
  .flag-type { font-size: 7.5pt; font-weight: bold; color: #9b2c2c; min-width: 70px; flex-shrink: 0; text-transform: uppercase; }
  .flag-ref { font-size: 7.5pt; color: #742a2a; min-width: 120px; flex-shrink: 0; font-family: monospace; }
  .flag-msg { font-size: 8pt; color: #822727; flex: 1; }

  /* ---- Footer ---- */
  .page-footer {
    position: fixed;
    bottom: 0.25in;
    left: 0.5in;
    right: 0.5in;
    border-top: 1px solid #e2e8f0;
    padding-top: 4px;
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #a0aec0;
  }

  @media print {
    .page { padding: 0; min-height: unset; }
  }
`;

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

function renderHeader(d: TemplateData, pageLabel: string): string {
  return `
    <div class="doc-header">
      <div class="doc-header-top">
        <div>
          <div class="doc-title">Wire Harness Work Instruction</div>
          <div class="doc-company">ACI Connectors · Engineering Document</div>
        </div>
        <div class="doc-meta">
          <div class="doc-pn">${esc(d.header.partNumber)}</div>
          <div class="doc-rev">Rev&nbsp;${esc(d.header.revision)}${d.header.description ? `&nbsp;·&nbsp;${esc(d.header.description)}` : ''}</div>
          <div class="doc-date">Generated: ${esc(d.header.generatedAt)}&nbsp;·&nbsp;${pageLabel}</div>
        </div>
      </div>
    </div>`;
}

function renderKomaxTable(rows: TemplateData['komaxRows']): string {
  if (rows.length === 0) return '<div class="section-empty">No Komax rows extracted</div>';
  const trs = rows.map(r => `
    <tr>
      <td class="mono">${esc(r.wireId)}</td>
      <td class="aci">${esc(r.aciPartNumber)}</td>
      <td class="center">${esc(r.gauge)}</td>
      <td>${esc(r.color)}</td>
      <td class="center mono">${esc(r.cutLength)}</td>
      <td class="center">${esc(r.stripA)}</td>
      <td class="center">${esc(r.stripB)}</td>
      <td class="mono">${esc(r.programNumber)}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr>
        <th>Wire ID</th><th>ACI Part Number</th><th>Gauge</th><th>Color</th>
        <th>Cut Length</th><th>Strip A</th><th>Strip B</th><th>Program #</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function renderPressTable(rows: TemplateData['pressRows']): string {
  if (rows.length === 0) return '<div class="section-empty">No press operations extracted</div>';
  const trs = rows.map(r => `
    <tr>
      <td class="mono">${esc(r.pressId)}</td>
      <td class="mono">${esc(r.wireId)}</td>
      <td class="aci">${esc(r.aciPartNumber)}</td>
      <td class="center">${esc(r.gauge)}</td>
      <td>${esc(r.color)}</td>
      <td class="mono">${esc(r.terminalPartNumber)}</td>
      <td class="mono">${esc(r.applicatorId)}</td>
      <td class="center">${esc(r.crimpHeight)}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr>
        <th>Press ID</th><th>Wire ID</th><th>ACI Part Number</th><th>Gauge</th>
        <th>Color</th><th>Terminal P/N</th><th>Applicator</th><th>Crimp Ht.</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function renderPinMapTable(rows: TemplateData['pinMapRows']): string {
  if (rows.length === 0) return '<div class="section-empty">No pin map rows extracted</div>';
  const trs = rows.map(r => `
    <tr>
      <td class="mono">${esc(r.pinMapId)}</td>
      <td class="mono">${esc(r.connectorId)}</td>
      <td class="center">${esc(r.cavity)}</td>
      <td class="mono">${esc(r.wireId)}</td>
      <td class="aci">${esc(r.aciPartNumber)}</td>
      <td class="mono">${esc(r.terminalPartNumber)}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr>
        <th>PM ID</th><th>Connector ID</th><th>Cavity</th>
        <th>Wire ID</th><th>ACI Part Number</th><th>Terminal P/N</th>
      </tr></thead>
      <tbody>${trs}</tbody>
    </table>`;
}

function renderAssemblySteps(steps: TemplateData['assemblySteps']): string {
  if (steps.length === 0) return '<div class="section-empty">No assembly steps extracted</div>';
  const items = steps.map(s => `
    <div class="step-item">
      <div class="step-num">${s.stepNumber}.</div>
      <div class="step-body">
        <div class="step-instruction">${esc(s.instruction)}</div>
        <div class="step-meta">
          ${s.wireIds !== '—' ? `Wires: <strong>${esc(s.wireIds)}</strong>&nbsp;&nbsp;` : ''}
          ${s.toolRef !== '—' ? `Tool: ${esc(s.toolRef)}&nbsp;&nbsp;` : ''}
          ${s.notes !== '—' ? `<em>Note: ${esc(s.notes)}</em>` : ''}
        </div>
      </div>
    </div>`).join('');
  return `<div class="steps-list">${items}</div>`;
}

function renderFlags(flags: TemplateData['engineeringFlags']): string {
  if (flags.length === 0) return '<div class="section-empty" style="background:#f0fff4;border-color:#c6f6d5;color:#276749">✓ No engineering flags — document is clean</div>';
  const items = flags.map(f => `
    <div class="flag-item">
      <div class="flag-id">${esc(f.flagId)}</div>
      <div class="flag-type">${esc(f.flagType)}</div>
      <div class="flag-ref">${esc(f.fieldRef)}</div>
      <div class="flag-msg">${esc(f.message)}</div>
    </div>`).join('');
  return `<div class="flags-list">${items}</div>`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Main HTML renderer
// ---------------------------------------------------------------------------

export function renderWorkInstructionHTML(job: HarnessInstructionJob): string {
  const d = buildTemplateData(job);

  const page1 = `
    <div class="page">
      ${renderHeader(d, 'Page 1 of 2')}

      <div class="section">
        <div class="section-title">Komax Program — Automated Cutting &amp; Stripping</div>
        ${renderKomaxTable(d.komaxRows)}
      </div>

      <div class="section">
        <div class="section-title">Manual Press Operations</div>
        ${renderPressTable(d.pressRows)}
      </div>
    </div>`;

  const page2 = `
    <div class="page page-break">
      ${renderHeader(d, 'Page 2 of 2')}

      <div class="section">
        <div class="section-title">Pin Map — Connector Assignments</div>
        ${renderPinMapTable(d.pinMapRows)}
      </div>

      <div class="section">
        <div class="section-title">Assembly Sequence</div>
        ${renderAssemblySteps(d.assemblySteps)}
      </div>

      <div class="section">
        <div class="section-title">Engineering Notes &amp; Flags</div>
        ${renderFlags(d.engineeringFlags)}
      </div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Work Instruction — ${esc(d.header.partNumber)} Rev ${esc(d.header.revision)}</title>
  <style>${CSS}</style>
</head>
<body>
  ${page1}
  ${page2}
  <div class="page-footer">
    <span>${esc(d.header.partNumber)} · Rev ${esc(d.header.revision)}</span>
    <span>ACI Connectors · CONFIDENTIAL</span>
    <span>Generated: ${esc(d.header.generatedAt)}</span>
  </div>
</body>
</html>`;
}
