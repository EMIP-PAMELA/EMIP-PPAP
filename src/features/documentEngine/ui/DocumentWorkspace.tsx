'use client';

import { useState } from 'react';
import { parseBOMText } from '../core/bomParser';
import { normalizeBOMData } from '../core/bomNormalizer';
import { generateDocumentDraft } from '../core/documentGenerator';
import { getTemplate } from '../templates/registry';
import { NormalizedBOM } from '../types/bomTypes';
import { TemplateId, DocumentDraft } from '../templates/types';
import { validateDocument } from '../validation/validateDocument';
import { ValidationResult } from '../validation/types';
import { BOMUpload } from './BOMUpload';
import { DocumentEditor } from './DocumentEditor';

type AppPhase = 'upload' | 'workflow';

const WORKFLOW_STEPS: Array<{ id: TemplateId; label: string; dependsOn: TemplateId[] }> = [
  { id: 'PROCESS_FLOW', label: 'Process Flow', dependsOn: [] },
  { id: 'PFMEA', label: 'PFMEA', dependsOn: ['PROCESS_FLOW'] },
  { id: 'CONTROL_PLAN', label: 'Control Plan', dependsOn: ['PFMEA'] },
  { id: 'PSW', label: 'PSW', dependsOn: ['CONTROL_PLAN'] }
];

const REGENERATION_SOURCE: Record<string, string> = {
  PROCESS_FLOW: 'BOM',
  PFMEA: 'BOM',
  CONTROL_PLAN: 'PFMEA',
  PSW: 'BOM'
};

const DEP_LABEL: Record<string, string> = {
  PFMEA: 'Derived from Process Flow',
  CONTROL_PLAN: 'Derived from PFMEA',
  PSW: 'Derived from Control Plan'
};

export function DocumentWorkspace() {
  const [appPhase, setAppPhase] = useState<AppPhase>('upload');
  const [normalizedBOM, setNormalizedBOM] = useState<NormalizedBOM | null>(null);
  const [activeStep, setActiveStep] = useState<TemplateId | null>(null);
  const [documents, setDocuments] = useState<Record<string, DocumentDraft>>({});
  const [editableDocuments, setEditableDocuments] = useState<Record<string, DocumentDraft>>({});
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [documentTimestamps, setDocumentTimestamps] = useState<Record<string, number>>({});
  const [regenMessage, setRegenMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBOMProcessed = (text: string) => {
    try {
      setError(null);
      console.log('[DocumentWorkspace] Parsing BOM text...');
      const parsed = parseBOMText(text);
      console.log('[DocumentWorkspace] Normalizing BOM data...');
      const normalized = normalizeBOMData(parsed);
      setNormalizedBOM(normalized);
      setAppPhase('workflow');
      console.log('[DocumentWorkspace] BOM processed:', normalized.masterPartNumber);
      console.log(`[DocumentWorkspace] Found ${normalized.summary.totalOperations} operations, ${normalized.summary.totalComponents} components`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process BOM');
      console.error('[DocumentWorkspace] Error processing BOM:', err);
    }
  };

  const handleStepClick = (stepId: TemplateId) => {
    if (!normalizedBOM) return;
    try {
      setError(null);
      const now = Date.now();
      const source = REGENERATION_SOURCE[stepId] ?? 'BOM';
      const stepDef = WORKFLOW_STEPS.find(s => s.id === stepId)!;
      const label = stepDef.label;
      const isRegen = !!documents[stepId];
      const msg = `${isRegen ? 'Regenerating' : 'Generating'} ${label} from ${source}`;
      setRegenMessage(msg);

      console.log(`[DocumentWorkspace] ${msg}`);
      const draft = generateDocumentDraft(stepId, { bom: normalizedBOM, externalData: {} });
      const editableCopy = structuredClone(draft);
      const template = getTemplate(stepId);
      const validation = validateDocument(editableCopy, template);

      setDocuments(prev => ({ ...prev, [stepId]: draft }));
      setEditableDocuments(prev => ({ ...prev, [stepId]: editableCopy }));
      setValidationResults(prev => ({ ...prev, [stepId]: validation }));
      setDocumentTimestamps(prev => ({ ...prev, [stepId]: now }));
      setActiveStep(stepId);

      console.log(`[DocumentWorkspace] ${stepId} generated:`, validation.isValid ? 'Valid' : `${validation.errors.length} errors`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to generate ${stepId}`);
      setRegenMessage(null);
      console.error(`[DocumentWorkspace] Error generating ${stepId}:`, err);
    }
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    if (!activeStep) return;
    setEditableDocuments(prev => {
      const current = prev[activeStep];
      if (!current) return prev;
      const updated = {
        ...current,
        fields: { ...current.fields, [fieldKey]: value }
      };
      const template = getTemplate(activeStep);
      const validation = validateDocument(updated, template);
      setValidationResults(vr => ({ ...vr, [activeStep]: validation }));
      return { ...prev, [activeStep]: updated };
    });
  };

  const handleResetToGenerated = () => {
    if (!activeStep || !documents[activeStep]) return;
    const resetDraft = structuredClone(documents[activeStep]);
    const template = getTemplate(activeStep);
    const validation = validateDocument(resetDraft, template);
    setEditableDocuments(prev => ({ ...prev, [activeStep]: resetDraft }));
    setValidationResults(prev => ({ ...prev, [activeStep]: validation }));
    console.log(`[DocumentWorkspace] ${activeStep} reset to generated version`);
  };

  const handleResetWorkspace = () => {
    setAppPhase('upload');
    setNormalizedBOM(null);
    setActiveStep(null);
    setDocuments({});
    setEditableDocuments({});
    setValidationResults({});
    setDocumentTimestamps({});
    setRegenMessage(null);
    setError(null);
  };

  const hasChanges = () => {
    if (!activeStep) return false;
    const orig = documents[activeStep];
    const edit = editableDocuments[activeStep];
    if (!orig || !edit) return false;
    return JSON.stringify(orig.fields) !== JSON.stringify(edit.fields);
  };

  const handleExportPDF = async () => {
    if (!activeStep || !editableDocuments[activeStep]) return;
    const editableDraft = editableDocuments[activeStep];
    try {
      setError(null);
      console.log('[DocumentWorkspace] Generating PDF...');
      // NOTE:
      // Using eval-based dynamic import to prevent Turbopack from
      // statically analyzing and bundling pdfGenerator into SSR.
      // This ensures PDF libraries (jsPDF/fflate) remain client-only.
      const generateModule = await (0, eval)("import('../export/pdfGenerator')");
      const { generatePDF } = generateModule;
      const templateModule = await import('../templates/registry');
      const template = templateModule.getTemplate(activeStep);
      const pdfBytes = await generatePDF(editableDraft, template);
      const arrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeStep}-${editableDraft.fields.partNumber || 'document'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      console.log('[DocumentWorkspace] PDF downloaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
      console.error('[DocumentWorkspace] Error generating PDF:', err);
    }
  };

  const currentEditableDraft = activeStep ? editableDocuments[activeStep] ?? null : null;
  const currentValidation = activeStep ? validationResults[activeStep] ?? null : null;

  const isStale = (stepId: string): boolean => {
    const step = WORKFLOW_STEPS.find(s => s.id === stepId);
    if (!step || !documents[stepId]) return false;
    const myTime = documentTimestamps[stepId] ?? 0;
    return step.dependsOn.some(dep => (documentTimestamps[dep] ?? 0) > myTime);
  };

  const dependencyStatus = (stepId: string) => {
    const step = WORKFLOW_STEPS.find(s => s.id === stepId);
    if (!step || step.dependsOn.length === 0) return [];
    return step.dependsOn.map(dep => ({
      step: dep,
      label: WORKFLOW_STEPS.find(s => s.id === dep)?.label ?? dep,
      exists: !!documents[dep]
    }));
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Workspace</h1>
        <p className="text-gray-600">Generate PPAP documents from BOM data</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-semibold mb-1">Error</h4>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {appPhase === 'upload' ? (
        <div className="bg-white rounded-lg shadow-md p-6">
          <BOMUpload onBOMProcessed={handleBOMProcessed} />
        </div>
      ) : (
        <>
          {/* BOM Summary */}
          {normalizedBOM && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-green-800 font-semibold mb-1">BOM Loaded</h4>
                  <div className="text-sm text-green-700 flex gap-6">
                    <span>Part: <strong>{normalizedBOM.masterPartNumber}</strong></span>
                    <span>Operations: <strong>{normalizedBOM.summary.totalOperations}</strong></span>
                    <span>Components: <strong>{normalizedBOM.summary.totalComponents}</strong> ({normalizedBOM.summary.wires}W / {normalizedBOM.summary.terminals}T / {normalizedBOM.summary.hardware}H)</span>
                  </div>
                </div>
                <button
                  onClick={handleResetWorkspace}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Load New BOM
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-6 items-start">
            {/* Step Navigation Panel */}
            <div className="w-52 flex-shrink-0">
              <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Document Chain
                </h3>
                <div className="space-y-1">
                  {WORKFLOW_STEPS.map((step, index) => {
                    const isGenerated = !!documents[step.id];
                    const isActive = activeStep === step.id;
                    const stale = isStale(step.id);
                    const deps = dependencyStatus(step.id);
                    const missingDeps = deps.filter(d => !d.exists);
                    const depLabel = DEP_LABEL[step.id];
                    return (
                      <div key={step.id}>
                        <button
                          onClick={() => handleStepClick(step.id)}
                          className={`w-full text-left rounded-md px-3 py-2.5 transition-colors ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : stale
                              ? 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
                              : isGenerated
                              ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isActive
                                ? 'bg-white text-blue-600'
                                : stale
                                ? 'bg-orange-400 text-white'
                                : isGenerated
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                            }`}>
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm leading-tight">{step.label}</div>
                              <div className={`text-xs mt-0.5 ${
                                isActive ? 'text-blue-100' : stale ? 'text-orange-600' : isGenerated ? 'text-green-600' : 'text-gray-400'
                              }`}>
                                {isActive ? 'Active' : stale ? 'May be stale' : isGenerated ? 'Generated' : 'Not Generated'}
                              </div>
                              {depLabel && (
                                <div className={`text-xs mt-0.5 ${
                                  isActive ? 'text-blue-200' : 'text-gray-400'
                                }`}>
                                  {depLabel}
                                </div>
                              )}
                            </div>
                          </div>
                          {missingDeps.length > 0 && !isActive && (
                            <div className="mt-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1">
                              ⚠ Depends on {missingDeps.map(d => d.label).join(', ')} (not yet generated)
                            </div>
                          )}
                          {stale && !isActive && (
                            <div className="mt-1.5 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                              ⚠ May be out of sync with {deps.map(d => d.label).join(', ')}
                            </div>
                          )}
                          {!stale && deps.length > 0 && deps.every(d => d.exists) && !isActive && isGenerated && (
                            <div className="mt-1.5 text-xs text-green-700">
                              ✓ Based on {deps.map(d => d.label).join(', ')}
                            </div>
                          )}
                        </button>
                        {index < WORKFLOW_STEPS.length - 1 && (
                          <div className="ml-5 w-px h-2 bg-gray-200 mx-auto" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
              {/* Regeneration Info Message */}
              {regenMessage && (
                <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <span className="text-blue-500 text-sm">ℹ</span>
                  <span className="text-blue-800 text-sm">{regenMessage}</span>
                </div>
              )}

              {/* Validation Summary */}
              {currentValidation && (
                <div className={`mb-4 border rounded-lg p-4 ${
                  currentValidation.isValid
                    ? 'bg-green-50 border-green-200'
                    : 'bg-yellow-50 border-yellow-200'
                }`}>
                  <h4 className={`font-semibold mb-1 ${
                    currentValidation.isValid ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {currentValidation.isValid
                      ? '✓ Document Valid'
                      : `⚠ ${currentValidation.errors.length} Validation ${currentValidation.errors.length === 1 ? 'Error' : 'Errors'}`}
                  </h4>
                  {!currentValidation.isValid && (
                    <div className="text-sm text-yellow-700 space-y-1">
                      {currentValidation.errors.slice(0, 5).map((err, idx) => (
                        <p key={idx}>
                          {err.rowIndex != null ? `Row ${err.rowIndex + 1}: ` : ''}
                          <strong>{err.field}</strong> — {err.message}
                        </p>
                      ))}
                      {currentValidation.errors.length > 5 && (
                        <p className="italic">...and {currentValidation.errors.length - 5} more</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Document Editor */}
              <div className="bg-white rounded-lg shadow-md p-6">
                {currentEditableDraft && activeStep ? (
                  <DocumentEditor
                    draft={currentEditableDraft}
                    templateId={activeStep}
                    onFieldChange={handleFieldChange}
                    onReset={handleResetToGenerated}
                    hasChanges={hasChanges()}
                  />
                ) : (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-4">📄</div>
                    <p className="text-lg font-medium text-gray-500">Select a document step to get started</p>
                    <p className="text-sm text-gray-400 mt-2">Click any step on the left to generate that document</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {currentEditableDraft && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleExportPDF}
                    className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors text-sm"
                  >
                    Download PDF
                  </button>
                  <button
                    onClick={() => activeStep && handleStepClick(activeStep)}
                    className="py-2.5 px-4 bg-gray-100 text-gray-700 rounded-md font-semibold hover:bg-gray-200 transition-colors text-sm border border-gray-200"
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
