/**
 * Document Type Registry
 * V3.3A
 *
 * Central configuration for all PPAP document types.
 * Defines default mode, editability, requirement level, and AI capability per document.
 *
 * MODE DEFINITIONS:
 *   generated — Claude produces the document programmatically from BOM + PPAP context.
 *               Requires an assigned owner.
 *   assisted  — Human-driven with tool support (e.g. Markup Tool for balloon drawing).
 *               Requires an assigned owner.
 *   static    — Filled in manually or sourced from supplier/customer. No AI generation.
 *               No owner required.
 *   na        — Not applicable for this PPAP. Excluded from submission package.
 *               Disabled in UI.
 *
 * PRESET LOGIC (workbook tab color approximation):
 *   Black tab (active Trane workbook sheet) → static as baseline
 *   Gray tab (inactive / N/A in Trane workbook) → na
 *   Coordinator can upgrade static → generated/assisted at intake.
 */

export type DocumentMode = 'generated' | 'assisted' | 'static' | 'na';

export interface DocumentTypeConfig {
  /** Matches DocumentItem.id in DocumentationForm */
  id: string;
  name: string;
  requirementLevel: 'REQUIRED' | 'CONDITIONAL';
  /** Starting mode applied when scope is first built */
  defaultMode: DocumentMode;
  /** Whether coordinator can override the mode at intake */
  modeEditable: boolean;
  /** Whether Claude can produce this document type */
  aiCapable: boolean;
}

export const DOCUMENT_REGISTRY: DocumentTypeConfig[] = [
  {
    id: 'ballooned_drawing',
    name: 'Ballooned Drawing',
    requirementLevel: 'REQUIRED',
    defaultMode: 'assisted',    // Engineer uses Markup Tool; tool-assisted, not fully generated
    modeEditable: false,        // Mode is fixed — always engineer-driven with tool
    aiCapable: false,
  },
  {
    id: 'design_record',
    name: 'Design Record',
    requirementLevel: 'REQUIRED',
    defaultMode: 'static',      // Customer-supplied drawing; coordinator uploads
    modeEditable: true,
    aiCapable: false,
  },
  {
    id: 'dimensional_results',
    name: 'Dimensional Results',
    requirementLevel: 'REQUIRED',
    defaultMode: 'static',      // Lab-measured data; engineer uploads
    modeEditable: true,
    aiCapable: false,
  },
  {
    id: 'dfmea',
    name: 'DFMEA',
    requirementLevel: 'REQUIRED',
    defaultMode: 'na',          // Typically N/A for wire harness assemblies (gray tab in Trane workbook)
    modeEditable: true,
    aiCapable: true,
  },
  {
    id: 'pfmea',
    name: 'PFMEA',
    requirementLevel: 'REQUIRED',
    defaultMode: 'generated',   // Claude generates from BOM + process context
    modeEditable: true,
    aiCapable: true,
  },
  {
    id: 'control_plan',
    name: 'Control Plan',
    requirementLevel: 'REQUIRED',
    defaultMode: 'generated',   // Claude generates from process flow
    modeEditable: true,
    aiCapable: true,
  },
  {
    id: 'msa',
    name: 'MSA',
    requirementLevel: 'REQUIRED',
    defaultMode: 'na',          // Typically N/A for wire harness assemblies (gray tab)
    modeEditable: true,
    aiCapable: false,
  },
  {
    id: 'material_test_results',
    name: 'Material Test Results',
    requirementLevel: 'REQUIRED',
    defaultMode: 'static',      // Supplier material certifications; coordinator uploads
    modeEditable: true,
    aiCapable: false,
  },
  {
    id: 'initial_process_studies',
    name: 'Initial Process Studies',
    requirementLevel: 'REQUIRED',
    defaultMode: 'na',          // Typically N/A for wire harness (gray tab)
    modeEditable: true,
    aiCapable: false,
  },
  {
    id: 'packaging',
    name: 'Packaging Specification',
    requirementLevel: 'CONDITIONAL',
    defaultMode: 'static',      // Customer-supplied packaging spec
    modeEditable: true,
    aiCapable: false,
  },
  {
    id: 'tooling',
    name: 'Tooling Documentation',
    requirementLevel: 'CONDITIONAL',
    defaultMode: 'na',          // Usually not required
    modeEditable: true,
    aiCapable: false,
  },
];

/** Modes that require an assigned owner */
export const OWNER_REQUIRED_MODES: DocumentMode[] = ['generated', 'assisted'];

/** Whether a given mode requires an owner */
export function requiresOwner(mode: DocumentMode): boolean {
  return OWNER_REQUIRED_MODES.includes(mode);
}

/** Human-readable labels for each mode */
export const MODE_LABELS: Record<DocumentMode, string> = {
  generated: 'Generated (AI)',
  assisted:  'Assisted (Tool)',
  static:    'Static (Manual)',
  na:        'N/A',
};

/** Badge color classes for each mode */
export const MODE_BADGE_CLASSES: Record<DocumentMode, string> = {
  generated: 'bg-purple-100 text-purple-800',
  assisted:  'bg-blue-100 text-blue-800',
  static:    'bg-gray-100 text-gray-700',
  na:        'bg-gray-50 text-gray-400',
};

/**
 * Build the default scope for a given PPAP type.
 * Returns one entry per document in the registry.
 */
export function buildDefaultScope(ppapType?: string): DocumentScopeEntry[] {
  return DOCUMENT_REGISTRY.map((doc) => ({
    documentId: doc.id,
    required: doc.requirementLevel === 'REQUIRED',
    mode: doc.defaultMode,
    owner: '',
  }));
}

/** A single document's scope configuration, as selected during intake */
export interface DocumentScopeEntry {
  documentId: string;
  required: boolean;
  mode: DocumentMode;
  owner: string;
}

/**
 * Validate the document scope before PPAP creation.
 * Returns an array of error strings (empty = valid).
 */
export function validateScope(scope: DocumentScopeEntry[]): string[] {
  const errors: string[] = [];

  for (const entry of scope) {
    if (!entry.required) continue;

    const config = DOCUMENT_REGISTRY.find((d) => d.id === entry.documentId);
    if (!config) continue;

    // Required docs must not be N/A
    if (entry.mode === 'na') {
      errors.push(`"${config.name}" is marked required but mode is N/A. Change mode or mark as not required.`);
      continue;
    }

    // Required generated/assisted docs must have an owner
    if (requiresOwner(entry.mode) && !entry.owner.trim()) {
      errors.push(`"${config.name}" (${MODE_LABELS[entry.mode]}) requires an assigned owner.`);
    }
  }

  return errors;
}
