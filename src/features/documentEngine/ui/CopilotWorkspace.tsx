'use client';

import { useState, useEffect } from 'react';
import { CopilotDraft } from '../types/copilotTypes';
import { CopilotChatPanel } from './CopilotChatPanel';
import { CopilotDraftPreview } from './CopilotDraftPreview';
import { listAvailableDocumentTypes } from '../entryPoints/standaloneCopilot';
import { launchStandaloneSession } from '../entryPoints/standaloneCopilot';
import { launchPpapBoundSession } from '../entryPoints/ppapBoundCopilot';
import { routeDraft } from '../services/copilotOutputRouter';
import { extractTextFromPDF } from '../utils/pdfToText';
import { parseBOMText } from '../core/bomParser';
import { normalizeBOMData } from '../core/bomNormalizer';
import { RawBOMData, NormalizedBOM } from '../types/bomTypes';

interface CopilotWorkspaceProps {
  ppapId?: string;
  documentType?: string;
}

type WorkspacePhase = 'setup' | 'active' | 'review' | 'complete';

export function CopilotWorkspace({ ppapId, documentType: preselectedDocType }: CopilotWorkspaceProps) {
  const [mode] = useState<'ppap-bound' | 'standalone'>(ppapId ? 'ppap-bound' : 'standalone');
  const [phase, setPhase] = useState<WorkspacePhase>('setup');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentDraft, setCurrentDraft] = useState<CopilotDraft | null>(null);
  
  // Setup phase state
  const [selectedDocType, setSelectedDocType] = useState<string>(preselectedDocType || '');
  const [availableDocTypes, setAvailableDocTypes] = useState<string[]>([]);
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [contextLoadError, setContextLoadError] = useState<string | null>(null);
  
  // File upload state (Standalone mode)
  const [bomFile, setBomFile] = useState<File | null>(null);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [drawingFile, setDrawingFile] = useState<File | null>(null);
  
  // BOM parsing state
  const [isParsing, setIsParsing] = useState(false);
  const [bomText, setBomText] = useState<string | null>(null);
  const [parsedBomData, setParsedBomData] = useState<RawBOMData | null>(null);
  const [normalizedBom, setNormalizedBom] = useState<NormalizedBOM | null>(null);
  const [parsingError, setParsingError] = useState<string | null>(null);
  const [componentCount, setComponentCount] = useState<number>(0);
  
  // PPAP-Bound context state
  const [ppapContext, setPpapContext] = useState<any>(null);
  const [autoLoadedFiles, setAutoLoadedFiles] = useState<{
    bom?: string;
    template?: string;
  }>({});
  
  // Draft acceptance state
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load available document types on mount
  useEffect(() => {
    const types = listAvailableDocumentTypes();
    setAvailableDocTypes(types);
    if (!selectedDocType && types.length > 0) {
      setSelectedDocType(types[0]);
    }
  }, [selectedDocType]);

  // Load PPAP context if in PPAP-Bound mode
  useEffect(() => {
    async function loadPpapContext() {
      if (mode !== 'ppap-bound' || !ppapId) return;
      
      setIsLoadingContext(true);
      setContextLoadError(null);
      
      try {
        // In a full implementation, this would call getEmipContext
        // For now, simulate context loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const mockContext = {
          partNumber: `PART-${ppapId}`,
          customerName: 'Mock Customer',
          revision: 'A',
          supplierName: 'Mock Supplier'
        };
        
        setPpapContext(mockContext);
        setAutoLoadedFiles({
          bom: 'Auto-loaded from PPAP record',
          template: 'Auto-loaded from customer requirements'
        });
        
        console.log('[CopilotWorkspace] PPAP context loaded:', mockContext);
      } catch (err) {
        console.error('[CopilotWorkspace] Error loading PPAP context:', err);
        setContextLoadError(err instanceof Error ? err.message : 'Failed to load PPAP context');
      } finally {
        setIsLoadingContext(false);
      }
    }
    
    loadPpapContext();
  }, [mode, ppapId]);

  // BOM parsing pipeline: PDF → text → parser → normalizer
  const parseBOMFile = async (file: File) => {
    setIsParsing(true);
    setParsingError(null);
    setParsedBomData(null);
    setNormalizedBom(null);
    setComponentCount(0);
    
    try {
      console.log('[CopilotWorkspace] Starting BOM parsing pipeline...');
      
      // Step 1: Extract text from PDF
      const text = await extractTextFromPDF(file);
      setBomText(text);
      console.log('[CopilotWorkspace] PDF text extracted:', text.length, 'characters');
      
      // Step 2: Parse BOM text into raw data
      const rawBomData = parseBOMText(text);
      setParsedBomData(rawBomData);
      console.log('[CopilotWorkspace] BOM parsed:', rawBomData.operations.length, 'operations');
      
      // Step 3: Normalize BOM data into business entities
      const normalized = normalizeBOMData(rawBomData);
      setNormalizedBom(normalized);
      
      // Count total components
      const totalComponents = normalized.operations.reduce(
        (sum, op) => sum + op.components.length,
        0
      );
      setComponentCount(totalComponents);
      
      console.log('[CopilotWorkspace] BOM normalized:', totalComponents, 'components found');
    } catch (err) {
      console.error('[CopilotWorkspace] BOM parsing failed:', err);
      setParsingError(err instanceof Error ? err.message : 'Failed to parse BOM');
    } finally {
      setIsParsing(false);
    }
  };
  
  // Handle BOM file upload and trigger parsing
  const handleBomFileChange = async (file: File | null) => {
    setBomFile(file);
    if (file) {
      await parseBOMFile(file);
    } else {
      // Clear parsing state if file removed
      setBomText(null);
      setParsedBomData(null);
      setNormalizedBom(null);
      setParsingError(null);
      setComponentCount(0);
    }
  };

  const canStartSession = (): boolean => {
    if (!selectedDocType) return false;
    
    if (mode === 'standalone') {
      // Standalone requires: BOM file uploaded AND parsed successfully, plus template file
      return (
        bomFile !== null &&
        (normalizedBom !== null || bomText !== null) &&
        parsingError === null &&
        !isParsing &&
        templateFile !== null
      );
    } else {
      // PPAP-Bound requires context loaded successfully
      return ppapContext !== null && !isLoadingContext;
    }
  };

  const handleStartSession = async () => {
    if (!canStartSession()) return;
    
    try {
      let newSessionId: string;
      
      if (mode === 'standalone') {
        console.log('[CopilotWorkspace] Starting Standalone session...');
        newSessionId = await launchStandaloneSession(selectedDocType, null);
      } else {
        console.log('[CopilotWorkspace] Starting PPAP-Bound session...');
        newSessionId = await launchPpapBoundSession(
          ppapId!,
          selectedDocType,
          ppapContext,
          null
        );
      }
      
      setSessionId(newSessionId);
      setPhase('active');
      console.log('[CopilotWorkspace] Session started:', newSessionId);
    } catch (err) {
      console.error('[CopilotWorkspace] Error starting session:', err);
      setContextLoadError(err instanceof Error ? err.message : 'Failed to start session');
    }
  };

  const handleDraftReady = (draft: CopilotDraft) => {
    console.log('[CopilotWorkspace] Draft ready for review');
    setCurrentDraft(draft);
    setPhase('review');
  };

  const handleAcceptDraft = async () => {
    if (!currentDraft || !sessionId) return;
    
    setIsSavingDraft(true);
    setSaveError(null);
    setSaveSuccess(false);
    
    try {
      console.log('[CopilotWorkspace] Accepting draft and routing to Vault...');
      
      const vaultFileId = await routeDraft(
        sessionId,
        currentDraft,
        selectedDocType,
        'current-user',
        ppapId
      );
      
      console.log('[CopilotWorkspace] Draft saved to Vault:', vaultFileId);
      setSaveSuccess(true);
      setPhase('complete');
      
      // Show success message
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);
      
    } catch (err) {
      console.error('[CopilotWorkspace] Error saving draft:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleRequestChanges = async (feedback: string) => {
    console.log('[CopilotWorkspace] User requested changes:', feedback);
    // Return to active phase so user can send feedback to Claude
    setPhase('active');
    setCurrentDraft(null);
    // Feedback will be sent as next message in chat
  };

  const handleNewSession = () => {
    setPhase('setup');
    setSessionId(null);
    setCurrentDraft(null);
    setBomFile(null);
    setTemplateFile(null);
    setDrawingFile(null);
    setSaveSuccess(false);
    setSaveError(null);
  };

  const getDocumentTypeLabel = (docType: string): string => {
    const labels: Record<string, string> = {
      'pfmea': 'Process FMEA',
      'controlPlan': 'Control Plan',
      'processFlow': 'Process Flow',
      'psw': 'Part Submission Warrant'
    };
    return labels[docType] || docType;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Copilot</h1>
              <p className="text-gray-600">AI-guided document generation with Claude</p>
            </div>
            
            {/* Mode Indicator */}
            <div className={`px-4 py-2 rounded-lg font-semibold ${
              mode === 'ppap-bound' 
                ? 'bg-purple-100 text-purple-800 border-2 border-purple-300'
                : 'bg-green-100 text-green-800 border-2 border-green-300'
            }`}>
              {mode === 'ppap-bound' ? '🔗 PPAP-Bound Mode' : '🆓 Standalone Mode'}
            </div>
          </div>
          
          {/* Mode Description */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              {mode === 'ppap-bound' 
                ? `Context automatically loaded from PPAP ${ppapId}. Claude will use existing BOM and requirements.`
                : 'Provide your own BOM and requirements. Claude will guide you through document creation.'}
            </p>
          </div>
        </div>

        {/* Setup Phase */}
        {phase === 'setup' && (
          <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Session Setup</h2>
            
            {/* Document Type Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Document Type
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a document type...</option>
                {availableDocTypes.map(type => (
                  <option key={type} value={type}>
                    {getDocumentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>

            {/* PPAP-Bound Context Loading */}
            {mode === 'ppap-bound' && (
              <div className="space-y-4">
                {isLoadingContext && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin w-5 h-5 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
                      <span className="text-yellow-800 font-medium">Loading context from PPAP...</span>
                    </div>
                  </div>
                )}
                
                {ppapContext && !isLoadingContext && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <h3 className="font-semibold text-green-900">✅ Auto-Loaded Context</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Part Number:</span>
                        <span className="ml-2 font-semibold text-gray-900">{ppapContext.partNumber}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Customer:</span>
                        <span className="ml-2 font-semibold text-gray-900">{ppapContext.customerName}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">BOM Source:</span>
                        <span className="ml-2 font-mono text-xs text-gray-700">{autoLoadedFiles.bom}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Template:</span>
                        <span className="ml-2 font-mono text-xs text-gray-700">{autoLoadedFiles.template}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {contextLoadError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800 font-semibold">Error loading context:</p>
                    <p className="text-red-700 text-sm mt-1">{contextLoadError}</p>
                  </div>
                )}
              </div>
            )}

            {/* Standalone File Uploads */}
            {mode === 'standalone' && (
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Required Files</h3>
                
                {/* BOM Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    BOM File (PDF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => handleBomFileChange(e.target.files?.[0] || null)}
                    disabled={isParsing}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                  />
                  
                  {/* Parsing Status */}
                  {isParsing && (
                    <div className="mt-2 flex items-center gap-2 text-blue-600">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                      <span className="text-sm font-medium">Parsing BOM...</span>
                    </div>
                  )}
                  
                  {/* Success State */}
                  {bomFile && normalizedBom && !isParsing && !parsingError && (
                    <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800 font-semibold">✓ {bomFile.name}</p>
                      <p className="text-xs text-green-700 mt-1">
                        BOM parsed: {componentCount} components found across {normalizedBom.operations.length} operations
                      </p>
                    </div>
                  )}
                  
                  {/* Error State */}
                  {parsingError && (
                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-800 font-semibold">Failed to parse BOM</p>
                      <p className="text-xs text-red-700 mt-1">{parsingError}</p>
                      <p className="text-xs text-red-600 mt-1">Please verify the PDF is a valid BOM file and try again.</p>
                    </div>
                  )}
                </div>

                {/* Template Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Excel Template <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {templateFile && (
                    <p className="text-sm text-green-600 mt-1">✓ {templateFile.name}</p>
                  )}
                </div>

                {/* Drawing Upload (Optional) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Engineering Drawing (Optional)
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setDrawingFile(e.target.files?.[0] || null)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {drawingFile && (
                    <p className="text-sm text-gray-600 mt-1">✓ {drawingFile.name}</p>
                  )}
                </div>
              </div>
            )}

            {/* Validation Messages */}
            {mode === 'standalone' && !canStartSession() && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-medium text-sm mb-2">⚠️ Requirements not met:</p>
                <ul className="text-xs text-yellow-700 space-y-1 ml-4 list-disc">
                  {!bomFile && <li>BOM PDF file required</li>}
                  {bomFile && isParsing && <li>Waiting for BOM parsing to complete...</li>}
                  {bomFile && parsingError && <li>BOM parsing failed - please upload a valid BOM PDF</li>}
                  {bomFile && !normalizedBom && !bomText && !isParsing && !parsingError && <li>BOM not yet parsed</li>}
                  {!templateFile && <li>Excel template file required</li>}
                </ul>
              </div>
            )}

            {/* Start Session Button */}
            <button
              onClick={handleStartSession}
              disabled={!canStartSession()}
              className={`w-full py-4 rounded-lg font-semibold text-white transition-colors ${
                canStartSession()
                  ? 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {isLoadingContext ? 'Loading context...' : isParsing ? 'Parsing BOM...' : 'Start Copilot Session'}
            </button>
          </div>
        )}

        {/* Active Phase - Chat with Claude */}
        {phase === 'active' && sessionId && (
          <div className="bg-white rounded-lg shadow-md" style={{ height: 'calc(100vh - 250px)' }}>
            <CopilotChatPanel
              sessionId={sessionId}
              documentType={selectedDocType}
              mode={mode}
              ppapId={ppapId}
              uploadedFiles={mode === 'standalone' ? {
                bomFile: bomFile || undefined,
                templateFile: templateFile || undefined,
                drawingFile: drawingFile || undefined
              } : undefined}
              bomText={bomText || undefined}
              parsedBomData={parsedBomData || undefined}
              normalizedBom={normalizedBom || undefined}
              onDraftReady={handleDraftReady}
              onQuestionAsked={(q) => console.log('Question asked:', q)}
            />
          </div>
        )}

        {/* Review Phase - Draft Preview */}
        {phase === 'review' && currentDraft && (
          <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Review Draft</h2>
            
            {/* Render CopilotDraftPreview */}
            <CopilotDraftPreview
              draft={currentDraft}
              onAccept={handleAcceptDraft}
              onRequestChanges={handleRequestChanges}
            />

            {/* Save Status Messages */}
            {isSavingDraft && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-blue-800 font-medium">Saving draft to Vault...</span>
                </div>
              </div>
            )}

            {saveError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold">Error saving draft:</p>
                <p className="text-red-700 text-sm mt-1">{saveError}</p>
              </div>
            )}
          </div>
        )}

        {/* Complete Phase */}
        {phase === 'complete' && (
          <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                <span className="text-4xl">✅</span>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Draft Saved Successfully!</h2>
              <p className="text-gray-600 mb-6">
                Your document draft has been saved to Vault with full AI provenance tracking.
              </p>
              
              {mode === 'ppap-bound' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <p className="text-purple-800 font-medium">
                    📬 PPAP Workflow Notified
                  </p>
                  <p className="text-purple-700 text-sm mt-1">
                    The PPAP workflow has been notified that a new document draft is ready for review.
                  </p>
                </div>
              )}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={handleNewSession}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                >
                  Generate Another Document
                </button>
                <a
                  href={mode === 'ppap-bound' ? `/ppap/${ppapId}` : '/ppap'}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-semibold inline-block"
                >
                  Return to Dashboard
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
