'use client';

import { useState } from 'react';
import { parseBOMText } from '../core/bomParser';
import { normalizeBOMData } from '../core/bomNormalizer';
import { generateDocumentDraft } from '../core/documentGenerator';
import { getTemplate } from '../templates/registry';
import { NormalizedBOM } from '../types/bomTypes';
import { TemplateId, DocumentDraft } from '../templates/types';
import { BOMUpload } from './BOMUpload';
import { TemplateSelector } from './TemplateSelector';
import { TemplateInputForm } from './TemplateInputForm';
import { DocumentEditor } from './DocumentEditor';

type WorkflowStep = 'upload' | 'select-template' | 'input-data' | 'edit';

export function DocumentWorkspace() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [rawText, setRawText] = useState<string | null>(null);
  const [normalizedBOM, setNormalizedBOM] = useState<NormalizedBOM | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [generatedDraft, setGeneratedDraft] = useState<DocumentDraft | null>(null);
  const [editableDraft, setEditableDraft] = useState<DocumentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBOMProcessed = (text: string) => {
    try {
      setError(null);
      setRawText(text);

      console.log('[DocumentWorkspace] Parsing BOM text...');
      const parsed = parseBOMText(text);
      
      console.log('[DocumentWorkspace] Normalizing BOM data...');
      const normalized = normalizeBOMData(parsed);
      
      setNormalizedBOM(normalized);
      setCurrentStep('select-template');
      
      console.log('[DocumentWorkspace] BOM processed successfully');
      console.log(`[DocumentWorkspace] Found ${normalized.summary.totalOperations} operations, ${normalized.summary.totalComponents} components`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process BOM');
      console.error('[DocumentWorkspace] Error processing BOM:', err);
    }
  };

  const handleTemplateSelected = (templateId: TemplateId) => {
    setSelectedTemplate(templateId);
    setCurrentStep('input-data');
  };

  const handleInputsComplete = (inputs: Record<string, any>) => {
    if (!normalizedBOM || !selectedTemplate) return;

    try {
      setError(null);
      
      console.log('[DocumentWorkspace] Generating document draft...');
      const draft = generateDocumentDraft(selectedTemplate, {
        bom: normalizedBOM,
        externalData: inputs
      });

      setGeneratedDraft(draft);
      
      // Create editable copy using structuredClone
      const editableCopy = structuredClone(draft);
      setEditableDraft(editableCopy);
      
      setCurrentStep('edit');
      
      console.log('[DocumentWorkspace] Document draft generated successfully');
      console.log('[DocumentWorkspace] Editable draft initialized');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate document');
      console.error('[DocumentWorkspace] Error generating document:', err);
    }
  };

  const handleResetWorkspace = () => {
    setCurrentStep('upload');
    setRawText(null);
    setNormalizedBOM(null);
    setSelectedTemplate(null);
    setGeneratedDraft(null);
    setEditableDraft(null);
    setError(null);
  };

  const handleResetToGenerated = () => {
    if (generatedDraft) {
      setEditableDraft(structuredClone(generatedDraft));
      console.log('[DocumentWorkspace] Draft reset to generated version');
    }
  };

  const handleFieldChange = (fieldKey: string, value: any) => {
    setEditableDraft(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        fields: {
          ...prev.fields,
          [fieldKey]: value
        }
      };
    });
  };

  const hasChanges = () => {
    if (!generatedDraft || !editableDraft) return false;
    return JSON.stringify(generatedDraft.fields) !== JSON.stringify(editableDraft.fields);
  };

  const handleExportPDF = async () => {
    if (!editableDraft || !selectedTemplate) return;

    try {
      setError(null);
      console.log('[DocumentWorkspace] Generating PDF...');
      
      // Dynamic import to ensure PDF generation only happens on client
      const { generatePDF, downloadPDF, generatePDFFilename } = await import('../export/pdfGenerator');
      
      const template = getTemplate(selectedTemplate);
      const pdfData = await generatePDF(editableDraft, template);
      const filename = generatePDFFilename(editableDraft);
      
      downloadPDF(pdfData, filename);
      
      console.log('[DocumentWorkspace] PDF downloaded:', filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PDF');
      console.error('[DocumentWorkspace] Error generating PDF:', err);
    }
  };

  const steps = [
    { id: 'upload', label: 'Upload BOM' },
    { id: 'select-template', label: 'Select Template' },
    { id: 'input-data', label: 'Provide Information' },
    { id: 'edit', label: 'Edit Document' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Document Workspace
        </h1>
        <p className="text-gray-600">
          Generate PPAP documents from BOM data
        </p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-semibold
                    ${index <= currentStepIndex
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                    }
                  `}
                >
                  {index + 1}
                </div>
                <span
                  className={`
                    text-sm mt-2
                    ${index <= currentStepIndex
                      ? 'text-gray-900 font-medium'
                      : 'text-gray-400'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`
                    h-1 flex-1 mx-2
                    ${index < currentStepIndex
                      ? 'bg-blue-600'
                      : 'bg-gray-200'
                    }
                  `}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-semibold mb-1">Error</h4>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* BOM Summary (if loaded) */}
      {normalizedBOM && currentStep !== 'upload' && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-green-800 font-semibold mb-2">BOM Loaded</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>Part Number: <strong>{normalizedBOM.masterPartNumber}</strong></p>
            <p>Operations: <strong>{normalizedBOM.summary.totalOperations}</strong></p>
            <p>Components: <strong>{normalizedBOM.summary.totalComponents}</strong> ({normalizedBOM.summary.wires} wires, {normalizedBOM.summary.terminals} terminals, {normalizedBOM.summary.hardware} hardware)</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-md p-6">
        {currentStep === 'upload' && (
          <BOMUpload onBOMProcessed={handleBOMProcessed} />
        )}

        {currentStep === 'select-template' && (
          <TemplateSelector
            onTemplateSelected={handleTemplateSelected}
            disabled={!normalizedBOM}
          />
        )}

        {currentStep === 'input-data' && selectedTemplate && (
          <TemplateInputForm
            templateId={selectedTemplate}
            onInputsComplete={handleInputsComplete}
          />
        )}

        {currentStep === 'edit' && editableDraft && generatedDraft && selectedTemplate && (
          <DocumentEditor 
            draft={editableDraft}
            templateId={selectedTemplate}
            onFieldChange={handleFieldChange}
            onReset={handleResetToGenerated}
            hasChanges={hasChanges()}
          />
        )}
      </div>

      {/* Actions */}
      {currentStep === 'edit' && (
        <div className="mt-6 flex gap-4">
          <button
            onClick={handleExportPDF}
            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 transition-colors"
          >
            Download PDF
          </button>
          <button
            onClick={handleResetWorkspace}
            className="flex-1 py-3 px-4 bg-gray-600 text-white rounded-md font-semibold hover:bg-gray-700 transition-colors"
          >
            Start New Document
          </button>
        </div>
      )}
    </div>
  );
}
