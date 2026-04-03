/**
 * Injection Engine
 * V3.2F — Schema-Driven Workbook Injection
 *
 * Responsibility:
 *   Accept structured JSON from the Copilot output contract,
 *   load a workbook template, route each document type to its
 *   sheet handler, and return the modified workbook.
 *
 * Governance rules (V3.2E / V3.2G-1):
 *   - Schema is the source of truth. Excel is a passive canvas.
 *   - Handlers MUST NOT modify formatting, merges, or styles.
 *   - This module is server-side only (ExcelJS requires Node.js fs).
 *   - Do NOT import this module from client-side code.
 */

import ExcelJS from 'exceljs';
import { handlePFMEA } from './sheets/pfmeaSheet';
import { handlePSW } from './sheets/pswSheet';
import { handleDimensional } from './sheets/dimensionalSheet';
import { handleMaterialTest } from './sheets/materialTestSheet';

// ============================================================================
// Public Interface
// ============================================================================

/**
 * Input to the injection engine.
 *
 * documents — keyed by document type identifier matching the V3.2E output
 *             contract (e.g. "pfmea", "psw", "dimensional", "material_test").
 * templatePath — absolute file system path to the customer workbook template.
 *                Caller is responsible for resolving the correct template.
 */
export type InjectionInput = {
  documents: Record<string, unknown>;
  templatePath: string;
};

/**
 * Load the workbook template and inject all documents.
 *
 * @returns The modified ExcelJS Workbook instance.
 *          Caller is responsible for serialization (do not write to disk here).
 * @throws  If the template cannot be loaded, a sheet is missing,
 *          or a schema mismatch is detected.
 */
export async function injectDocuments(
  input: InjectionInput
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(input.templatePath);
  } catch (err) {
    throw new Error(
      `[InjectionEngine] Failed to load template at "${input.templatePath}": ${String(err)}`
    );
  }

  for (const [docType, data] of Object.entries(input.documents)) {
    routeToHandler(workbook, docType, data);
  }

  return workbook;
}

// ============================================================================
// Routing Layer
// ============================================================================

function routeToHandler(
  workbook: ExcelJS.Workbook,
  docType: string,
  data: unknown
): void {
  switch (docType) {
    case 'pfmea':
      handlePFMEA(workbook, data);
      break;
    case 'psw':
      handlePSW(workbook, data);
      break;
    case 'dimensional':
      handleDimensional(workbook, data);
      break;
    case 'material_test':
      handleMaterialTest(workbook, data);
      break;
    default:
      throw new Error(
        `[InjectionEngine] Unknown document type: "${docType}". ` +
        `Supported types: pfmea, psw, dimensional, material_test.`
      );
  }
}
