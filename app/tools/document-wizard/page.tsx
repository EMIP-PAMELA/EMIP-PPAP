'use client';

import { useState, useEffect } from 'react';
import { parseVisualMaster } from '@/src/features/bom/visualMasterParser';
import { normalizeVisualMasterText, getPreprocessingSummary, getTextPreview, PreprocessingSummary } from '@/src/features/bom/visualMasterPreprocessor';
import { validateParsedVisualMaster, isCriticallyEmpty, getValidationStatusMessage, ParserValidationResult } from '@/src/features/bom/visualMasterValidator';
import { DocumentEditor } from '@/src/features/documentEngine/ui/DocumentEditor';
import { DocumentDraft, TemplateId } from '@/src/features/documentEngine/templates/types';
import { getTemplate, listTemplates } from '@/src/features/documentEngine/templates/registry';
import { NormalizedBOM } from '@/src/features/documentEngine/types/bomTypes';

/**
 * Phase W1: Document Wizard Foundation
 * Phase W1.2: Visual Master Parser Integration
 * Phase W1.4: Parser Stabilization Layer
 * 
 * Standalone document generation tool (workflow-independent)
 * - No PPAP session required
 * - No workflow state
 * - No approval gates
 * - Ephemeral documents (not session-bound)
 * - Persistent templates (shared registry)
 * - W1.4: Preprocessing and validation for robust parsing
 */

interface MappingDiagnostics {
  totalFields: number;
  populatedFields: number;
  emptyFields: number;
  mappingCoverage: number;
  missingFields: Array<{ fieldKey: string; section: string }>;
}

export default function DocumentWizardPage() {
  console.log('[Document Wizard] Page loaded successfully - Route registered');
  
  // State: Inputs
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [bomFile, setBomFile] = useState<File | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId | null>(null);
  
  // State: Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State: Outputs
  const [parsedBOM, setParsedBOM] = useState<any>(null);
  const [generatedDraft, setGeneratedDraft] = useState<DocumentDraft | null>(null);
  const [diagnostics, setDiagnostics] = useState<MappingDiagnostics | null>(null);
  
  // W1.4: Preprocessing and validation state
  const [rawExtractedText, setRawExtractedText] = useState<string>('');
  const [normalizedText, setNormalizedText] = useState<string>('');
  const [preprocessingSummary, setPreprocessingSummary] = useState<PreprocessingSummary | null>(null);
  const [validationResult, setValidationResult] = useState<ParserValidationResult | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(false);

  // Available templates from registry
  const availableTemplates = listTemplates();

  // W1.2 UI FIX: Auto-regenerate when template changes (if BOM already loaded)
  useEffect(() => {
    if (selectedTemplateId && parsedBOM && !isProcessing) {
      console.log('[W1.2] Template changed, regenerating document...');
      handleGenerate();
    }
  }, [selectedTemplateId]); // Only trigger on template change

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
    setValidationResult(null);
    
    console.log('[Wizard] BOM uploaded:', file.name, file.type);
    
    try {
      // STEP 1: Extract raw text from file
      const rawText = await file.text();
      setRawExtractedText(rawText);
      console.log('[W1.4 PREPROCESS] Raw text extracted:', rawText.length, 'characters');
      
      // STEP 2: W1.4 PREPROCESSING - Normalize text before parsing
      const normalized = normalizeVisualMasterText(rawText);
      setNormalizedText(normalized);
      
      // Get preprocessing summary for debugging
      const prepSummary = getPreprocessingSummary(rawText, normalized);
      setPreprocessingSummary(prepSummary);
      
      console.log('[W1.4 PREPROCESS] Original lines:', prepSummary.originalLineCount);
      console.log('[W1.4 PREPROCESS] Normalized lines:', prepSummary.normalizedLineCount);
      console.log('[W1.4 PREPROCESS] Dash normalizations:', prepSummary.dashNormalizations);
      console.log('[W1.4 PREPROCESS] Tabs normalized:', prepSummary.tabsNormalized);
      console.log('[W1.4 PREPROCESS] Trailing whitespace removed:', prepSummary.trailingWhitespaceRemoved);
      
      // STEP 3: Parse using Visual Master Parser v5.0 (with normalized text)
      const parsedData = parseVisualMaster(normalized);
      
      console.log('[W1.4 PARSER] Operations:', parsedData.operations.length);
      console.log('[W1.4 PARSER] Components:', parsedData.parts.length);
      console.log('[W1.4 PARSER] Master PN:', parsedData.masterPartNumber);
      
      // STEP 4: W1.4 VALIDATION - Validate parser output
      // Future Phase: AI verification hook can evaluate parser output here.
      const validation = validateParsedVisualMaster(parsedData);
      setValidationResult(validation);
      
      console.log('[W1.4 VALIDATION] Is valid:', validation.isValid);
      console.log('[W1.4 VALIDATION] Warnings:', validation.warnings.length);
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => console.warn('[W1.4 VALIDATION]', warning));
      }
      
      // STEP 5: HARD FAILURE CHECK - Don't silently pass empty results
      if (isCriticallyEmpty(parsedData)) {
        console.error('[W1.4 CRITICAL] Parser returned zero operations and zero components');
        console.error('[W1.4 CRITICAL] First 10 normalized lines:', normalized.split('\n').slice(0, 10).join('\n'));
        setError('❌ Parsing failed: No operations or components detected. See console for details.');
      } else if (validation.warnings.length > 0) {
        // Show warnings but don't block
        console.warn('[W1.4] Parsing completed with warnings. See validation panel below.');
      }
      
      setParsedBOM(parsedData);
      console.log('[Wizard] BOM stored successfully');
      
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
    
    if (!parsedBOM) {
      setError('Please upload a BOM file');
      return;
    }

    setIsProcessing(true);
    setError(null);
    
    try {
      console.log('[Wizard] Starting document generation');
      console.log('[Wizard] Template:', selectedTemplateId);
      console.log('[Wizard] BOM part:', parsedBOM.masterPartNumber);
      
      const template = getTemplate(selectedTemplateId);
      console.log('[Wizard] Template retrieved:', template.name);
      
      // W1.4 ADAPTER LOGGING - Track data through adaptation layer
      console.log('[W1.4 ADAPTER] Starting adaptation: Parser → NormalizedBOM');
      console.log('[W1.4 ADAPTER] Parsed operations:', parsedBOM.operations.length);
      console.log('[W1.4 ADAPTER] Parsed parts (flat):', parsedBOM.parts.length);
      
      // Adapt Visual Master Parser output to NormalizedBOM format
      const normalizedBOM = {
        masterPartNumber: parsedBOM.masterPartNumber,
        operations: parsedBOM.operations.map((op: any) => ({
          step: op.step,
          resourceId: op.resourceId,
          description: op.description,
          components: op.components.map((comp: any) => ({
            partId: comp.partId,
            aciCode: comp.aciCode,
            description: comp.fullDescription,
            quantity: comp.quantity,
            uom: comp.unitOfMeasure,
            componentType: comp.componentClass
          })),
          processLines: [],
          metadataLines: op.rawLines || []
        })),
        summary: {
          totalOperations: parsedBOM.operationCount,
          totalComponents: parsedBOM.componentCount,
          wires: parsedBOM.parts.filter((p: any) => p.componentClass === 'Consumable/Wire').length,
          terminals: parsedBOM.parts.filter((p: any) => p.isTerminal).length,
          hardware: parsedBOM.parts.filter((p: any) => p.componentClass === 'Hardware').length
        }
      };
      
      console.log('[W1.4 ADAPTER] Adapted operations:', normalizedBOM.operations.length);
      const totalAdaptedComponents = normalizedBOM.operations.reduce((sum: number, op: any) => sum + op.components.length, 0);
      console.log('[W1.4 ADAPTER] Adapted components (total):', totalAdaptedComponents);
      
      // W1.4 HARD FAILURE CHECK - Detect data loss during adaptation
      if (parsedBOM.parts.length > 0 && totalAdaptedComponents === 0) {
        console.error('[W1.4 ADAPTER CRITICAL] Data loss detected: Parser had components, adapter has zero');
        setError('⚠️ Generated shell only — source BOM structure was not detected.');
      }
      
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
              {parsedBOM && (
                <div className="mt-2 text-sm text-green-600">
                  ✓ BOM loaded: {parsedBOM.masterPartNumber} ({parsedBOM.operationCount} ops, {parsedBOM.componentCount} components)
                </div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedTemplateId || !parsedBOM || isProcessing}
              className={`w-full py-3 px-4 rounded-md font-semibold text-white transition-colors ${
                !selectedTemplateId || !parsedBOM || isProcessing
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
            
            {/* W1.4: Validation Warnings Panel */}
            {validationResult && validationResult.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-semibold text-yellow-800 mb-2">
                  ⚠️ Parser Warnings ({validationResult.warnings.length})
                </h3>
                <ul className="space-y-1">
                  {validationResult.warnings.map((warning, idx) => (
                    <li key={idx} className="text-sm text-yellow-700">
                      {warning}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 pt-3 border-t border-yellow-200">
                  <p className="text-xs text-yellow-600">
                    Status: {getValidationStatusMessage(validationResult)}
                  </p>
                </div>
              </div>
            )}
            
            {/* W1.4: Preprocessing Summary */}
            {preprocessingSummary && parsedBOM && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-semibold text-blue-800 mb-2">
                  Preprocessing Summary
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs text-blue-700">
                  <div>
                    <span className="font-medium">Original lines:</span> {preprocessingSummary.originalLineCount}
                  </div>
                  <div>
                    <span className="font-medium">Normalized lines:</span> {preprocessingSummary.normalizedLineCount}
                  </div>
                  <div>
                    <span className="font-medium">Dash normalizations:</span> {preprocessingSummary.dashNormalizations}
                  </div>
                  <div>
                    <span className="font-medium">Tabs normalized:</span> {preprocessingSummary.tabsNormalized}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* W1.4: Debug Preview Panel */}
        {(rawExtractedText || normalizedText || parsedBOM) && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Debug Preview</h2>
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
              >
                {showDebugPanel ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showDebugPanel && (
              <div className="space-y-4">
                {/* Raw Extracted Text Preview */}
                {rawExtractedText && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Raw Extracted Text (First 150 lines)
                    </h3>
                    <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-64 font-mono">
                      {getTextPreview(rawExtractedText, 150)}
                    </pre>
                  </div>
                )}
                
                {/* Normalized Text Preview */}
                {normalizedText && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Normalized Text (First 150 lines)
                    </h3>
                    <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-64 font-mono">
                      {getTextPreview(normalizedText, 150)}
                    </pre>
                  </div>
                )}
                
                {/* Parsed JSON Preview */}
                {parsedBOM && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">
                      Parsed JSON Preview (Summary)
                    </h3>
                    <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-auto max-h-64 font-mono">
                      {JSON.stringify({
                        masterPartNumber: parsedBOM.masterPartNumber,
                        operationCount: parsedBOM.operationCount,
                        componentCount: parsedBOM.componentCount,
                        operations: parsedBOM.operations.slice(0, 2).map((op: any) => ({
                          step: op.step,
                          resourceId: op.resourceId,
                          description: op.description,
                          componentCount: op.components.length
                        })),
                        note: parsedBOM.operations.length > 2 ? `... ${parsedBOM.operations.length - 2} more operations` : 'All operations shown'
                      }, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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
                <button
                  onClick={handleExportJSON}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                >
                  Download as JSON
                </button>
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
