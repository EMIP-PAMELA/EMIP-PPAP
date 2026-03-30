'use client';

import { useState } from 'react';
import { parseBOMText } from '@/src/features/documentEngine/core/bomParser';
import { normalizeBOMData } from '@/src/features/documentEngine/core/bomNormalizer';
import { DocumentEditor } from '@/src/features/documentEngine/ui/DocumentEditor';
import { DocumentDraft, TemplateId } from '@/src/features/documentEngine/templates/types';
import { getTemplate, listTemplates } from '@/src/features/documentEngine/templates/registry';
import { NormalizedBOM } from '@/src/features/documentEngine/types/bomTypes';
import { extractTextFromPDF } from '@/src/features/documentEngine/utils/pdfToText';

/**
 * Phase W1: Document Wizard Foundation
 * 
 * Standalone document generation tool (workflow-independent)
 * - No PPAP session required
 * - No workflow state
 * - No approval gates
 * - Ephemeral documents (not session-bound)
 * - Persistent templates (shared registry)
 */

interface MappingDiagnostics {
  totalFields: number;
  populatedFields: number;
  emptyFields: number;
  mappingCoverage: number;
  missingFields: Array<{ fieldKey: string; section: string }>;
}

export default function DocumentWizardPage() {
  // State: Inputs
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [bomFile, setBomFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | null>(null);
  
  // State: Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State: Outputs
  const [normalizedBOM, setNormalizedBOM] = useState<NormalizedBOM | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<DocumentDraft | null>(null);
  const [diagnostics, setDiagnostics] = useState<MappingDiagnostics | null>(null);

  // Available templates from registry
  const availableTemplates = listTemplates();

  // Handle template file upload
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTemplateFile(file);
    setError(null);
    
    console.log('[Wizard] Template uploaded:', file.name, file.type);
    
    // For Phase W1, we only support selecting from existing templates
    // Full template upload parsing is Phase W2
    if (file.type === 'application/json') {
      try {
        const text = await file.text();
        const templateData = JSON.parse(text);
        console.log('[Wizard] Template JSON parsed:', templateData);
        // Note: For W1, we won't register this template yet
        // Just log it for now
      } catch (err) {
        console.error('[Wizard] Failed to parse template JSON:', err);
        setError('Failed to parse template JSON. Please select a template from the dropdown.');
      }
    } else {
      console.log('[Wizard] Non-JSON template uploaded. Full parsing in Phase W2.');
      setError('PDF/Excel template parsing coming in Phase W2. Please select a template from the dropdown.');
    }
  };

  // Handle BOM file upload
  const handleBOMUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBomFile(file);
    setError(null);
    
    console.log('[Wizard] BOM uploaded:', file.name, file.type);
    
    try {
      // V2.1 Fix: Extract text from PDF if needed
      let text: string;
      const isPDF = file.type === 'application/pdf';
      
      if (isPDF) {
        console.log('[Wizard] Extracting text from PDF...');
        text = await extractTextFromPDF(file);
        console.log('[Wizard] PDF extraction complete');
      } else {
        text = await file.text();
      }
      
      console.log('[Wizard] BOM text length:', text.length);
      
      // V2.1 Fix: Check for empty extraction
      if (!text.trim()) {
        throw new Error('File is empty or contains no extractable text');
      }
      
      // Parse BOM using existing parser
      const rawBOM = parseBOMText(text);
      console.log('[Wizard] BOM parsed successfully');
      console.log('[Wizard] Operations:', rawBOM.operations.length);
      
      // Count total components across all operations
      const totalComponents = rawBOM.operations.reduce((sum, op) => sum + op.components.length, 0);
      console.log('[Wizard] Total components:', totalComponents);
      
      // V2.1 Fix: Warn if parsing produced empty results
      if (rawBOM.operations.length === 0) {
        console.warn('[Wizard] ⚠️ No operations detected after parsing');
        setError('⚠️ No operations detected — check BOM format or file content');
      }
      
      // Normalize BOM using existing normalizer
      const normalized = normalizeBOMData(rawBOM);
      console.log('[Wizard] BOM normalized successfully');
      
      setNormalizedBOM(normalized);
      console.log('[Wizard] BOM stored');
      
    } catch (err) {
      console.error('[Wizard] BOM parsing failed:', err);
      setError(`Failed to parse BOM: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Generate document
  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      setError('Please select a template');
      return;
    }
    
    if (!normalizedBOM) {
      setError('Please upload a BOM file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      console.log('[Wizard] Starting document generation');
      console.log('[Wizard] Template:', selectedTemplateId);
      console.log('[Wizard] BOM part:', normalizedBOM.masterPartNumber);
      
      const template = getTemplate(selectedTemplateId);
      console.log('[Wizard] Template retrieved:', template.name);
      
      // Use template.generate() method (Phase W1: basic generation)
      const draft = template.generate({ bom: normalizedBOM });
      
      setGeneratedDraft(draft);
      console.log('[Wizard] Document generated successfully');
      console.log('[Wizard] Fields:', Object.keys(draft.fields).length);
      
      // Calculate diagnostics
      calculateDiagnostics(draft, template);
      
      console.log('[Wizard] Document generation complete');
      
    } catch (err) {
      console.error('[Wizard] Generation failed:', err);
      setError(`Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculate mapping diagnostics
  const calculateDiagnostics = (draft: DocumentDraft, template: any) => {
    const totalFields = template.fieldDefinitions?.length || 0;
    const populatedFields = Object.keys(draft.fields).filter(key => {
      const value = draft.fields[key];
      return value !== null && value !== undefined && value !== '';
    }).length;
    const emptyFields = totalFields - populatedFields;
    const mappingCoverage = totalFields > 0 ? Math.round((populatedFields / totalFields) * 100) : 0;
    
    // Find missing fields (top 10)
    const missingFields: Array<{ fieldKey: string; section: string }> = [];
    if (template.fieldDefinitions) {
      for (const fieldDef of template.fieldDefinitions) {
        const value = draft.fields[fieldDef.key];
        if (!value || value === '') {
          missingFields.push({
            fieldKey: fieldDef.key,
            section: fieldDef.section || 'Unknown'
          });
        }
        if (missingFields.length >= 10) break;
      }
    }
    
    setDiagnostics({
      totalFields,
      populatedFields,
      emptyFields,
      mappingCoverage,
      missingFields
    });
    
    console.log('[Wizard] Diagnostics calculated:', {
      totalFields,
      populatedFields,
      mappingCoverage: `${mappingCoverage}%`
    });
  };

  // Handle field change in editor
  const handleFieldChange = (fieldPath: string, value: any) => {
    if (!generatedDraft) return;
    
    setGeneratedDraft({
      ...generatedDraft,
      fields: {
        ...generatedDraft.fields,
        [fieldPath]: value
      }
    });
    
    console.log('[Wizard] Field updated:', fieldPath);
  };

  // Export as JSON
  const handleExportJSON = () => {
    if (!generatedDraft) return;
    
    const dataStr = JSON.stringify(generatedDraft, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${generatedDraft.templateId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    console.log('[Wizard] Document exported as JSON');
  };

  // V2.6 / V2.6B: Export to Excel Template
  const handleExportExcel = async () => {
    if (!generatedDraft) return;
    
    try {
      console.log('[V2.6 EXPORT] Starting Excel template export for:', generatedDraft.templateId);
      
      const { exportToExcelTemplate, downloadExcelFile } = await import('@/src/features/documentEngine/export/excelTemplateInjector');
      
      let cellMap;
      let filename;
      
      // V2.6B: Route to appropriate template mapping
      switch (generatedDraft.templateId) {
        case 'process-flow-wizard': {
          const { PROCESS_FLOW_WORKBOOK_MAP } = await import('@/src/features/documentEngine/export/mappings/processFlowWorkbookMap');
          cellMap = PROCESS_FLOW_WORKBOOK_MAP;
          filename = `process-flow-${generatedDraft.fields.partNumber || 'export'}-${Date.now()}.xlsx`;
          break;
        }
        
        case 'pfmea-summary-wizard': {
          const { PFMEA_SUMMARY_WORKBOOK_MAP } = await import('@/src/features/documentEngine/export/mappings/pfmeaSummaryWorkbookMap');
          cellMap = PFMEA_SUMMARY_WORKBOOK_MAP;
          filename = `pfmea-summary-${generatedDraft.fields.partNumber || 'export'}-${Date.now()}.xlsx`;
          break;
        }
        
        default:
          alert(`Excel template export not yet implemented for: ${generatedDraft.templateId}\n\nCurrently supported:\n- Process Flow\n- PFMEA Summary`);
          return;
      }
      
      const blob = await exportToExcelTemplate(generatedDraft, cellMap);
      downloadExcelFile(blob, filename);
      
      console.log('[V2.6 EXPORT] Excel template export complete:', filename);
    } catch (err) {
      console.error('[V2.6 EXPORT] Export failed:', err);
      alert(`Excel export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Wizard</h1>
          <p className="text-gray-600">
            Standalone document generation tool - No PPAP session required
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Inputs</h2>
          
          <div className="space-y-4">
            {/* Template Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Template
              </label>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(e.target.value as TemplateId)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select a template --</option>
                {availableTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Template Upload (Phase W2) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Template (Phase W2 - Coming Soon)
              </label>
              <input
                type="file"
                accept=".json,.pdf,.xlsx"
                onChange={handleTemplateUpload}
                disabled={true}
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">
                Template upload parsing coming in Phase W2
              </p>
            </div>

            {/* BOM Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload BOM / Engineering Master
              </label>
              <input
                type="file"
                accept=".txt,.pdf"
                onChange={handleBOMUpload}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {normalizedBOM && (
                <div className="mt-2 text-sm text-green-600">
                  ✓ BOM loaded: {normalizedBOM.masterPartNumber} ({normalizedBOM.summary.totalOperations} ops, {normalizedBOM.summary.totalComponents} components)
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedTemplateId || !normalizedBOM || isProcessing}
              className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
                !selectedTemplateId || !normalizedBOM || isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {isProcessing ? 'Generating...' : 'Generate Document'}
            </button>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Output Section */}
        {generatedDraft && (
          <>
            {/* Mapping Diagnostics Panel */}
            {diagnostics && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Mapping Diagnostics</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Mapping Coverage */}
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-600 font-medium mb-1">Mapping Coverage</p>
                    <p className="text-3xl font-bold text-blue-900">{diagnostics.mappingCoverage}%</p>
                  </div>

                  {/* Field Stats */}
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-sm text-gray-600 font-medium mb-1">Field Stats</p>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>Total: <strong>{diagnostics.totalFields}</strong></p>
                      <p>Populated: <strong className="text-green-600">{diagnostics.populatedFields}</strong></p>
                      <p>Empty: <strong className="text-red-600">{diagnostics.emptyFields}</strong></p>
                    </div>
                  </div>
                </div>

                {/* Missing Fields */}
                {diagnostics.missingFields.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Missing Fields (Top {Math.min(10, diagnostics.missingFields.length)})
                    </p>
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200 max-h-48 overflow-y-auto">
                      {diagnostics.missingFields.map((field, idx) => (
                        <div key={idx} className="text-sm text-yellow-800 py-1">
                          • <span className="font-mono">{field.fieldKey}</span>
                          <span className="text-yellow-600 ml-2">({field.section})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Editor */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Generated Document</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportJSON}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    Export as JSON
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Export to PPAP Package Workbook Template"
                  >
                    Export to Excel Template
                  </button>
                </div>
              </div>
              
              <DocumentEditor
                draft={generatedDraft}
                templateId={generatedDraft.templateId}
                onFieldChange={handleFieldChange}
                readOnly={false}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
