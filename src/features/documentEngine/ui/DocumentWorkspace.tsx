'use client';

import { useState, useEffect } from 'react';
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
import { mapBOMToProcessFlow } from '../mapping/bomToProcessFlow';
import { mapProcessFlowToPFMEA } from '../mapping/processFlowToPFMEA';
import { mapPFMEAToControlPlan } from '../mapping/pfmeaToControlPlan';
import {
  loadSessions,
  loadSessionById,
  createSession,
  saveSession,
  deleteSession as deleteSessionDB,
  migrateLocalStorageSessions,
  StoredSession,
  PPAPSession,
  DocumentMetadata,
  DocumentStatus
} from '../persistence/sessionService';
import { getCurrentUser, canApprove, getRoleDisplayName, getRoleColor, type PPAPUser } from '@/src/features/auth/userService';
import { 
  createVersion, 
  getVersions, 
  getLatestVersion, 
  generateDocumentId,
  type DocumentVersion 
} from '../persistence/versionService';

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

const STEP_ORDER: TemplateId[] = [
  'PROCESS_FLOW',
  'PFMEA',
  'CONTROL_PLAN',
  'PSW'
];

const STEP_DESCRIPTION: Record<string, string> = {
  PROCESS_FLOW: 'Define manufacturing steps',
  PFMEA: 'Analyze potential failures',
  CONTROL_PLAN: 'Define process controls',
  PSW: 'Finalize submission'
};

interface DocumentWorkspaceProps {
  ppapId?: string;
}

export function DocumentWorkspace({ ppapId }: DocumentWorkspaceProps = {}) {
  const [appPhase, setAppPhase] = useState<AppPhase>('upload');
  const [normalizedBOM, setNormalizedBOM] = useState<NormalizedBOM | null>(null);
  const [activeStep, setActiveStep] = useState<TemplateId | null>(null);
  const [documents, setDocuments] = useState<Record<string, DocumentDraft>>({});
  const [editableDocuments, setEditableDocuments] = useState<Record<string, DocumentDraft>>({});
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({});
  const [documentTimestamps, setDocumentTimestamps] = useState<Record<string, number>>({});
  const [documentMeta, setDocumentMeta] = useState<Record<string, DocumentMetadata>>({});
  const [regenMessage, setRegenMessage] = useState<string | null>(null);
  const [prereqWarning, setPrereqWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Multi-session state
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Phase 23: User state
  const [currentUser, setCurrentUser] = useState<PPAPUser | null>(null);
  
  // Phase 24: Version tracking
  const [documentVersions, setDocumentVersions] = useState<Record<string, DocumentVersion[]>>({});
  const [currentVersionNumbers, setCurrentVersionNumbers] = useState<Record<string, number>>({});
  
  // Phase 25: Version viewing and locking
  const [viewingVersionNumber, setViewingVersionNumber] = useState<Record<string, number | null>>({});
  const [showVersionHistory, setShowVersionHistory] = useState<Record<string, boolean>>({});
  const [isViewingOldVersion, setIsViewingOldVersion] = useState(false);

  // Phase 28: Package export
  const [packageEligibility, setPackageEligibility] = useState<{ isEligible: boolean; message: string } | null>(null);
  const [isExportingPackage, setIsExportingPackage] = useState(false);

  // Phase 31: Customer and template assignment
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerTemplates, setCustomerTemplates] = useState<string[]>([]);
  
  // Phase 31.5: Customer selection for new sessions
  const [availableCustomers, setAvailableCustomers] = useState<Array<{id: string; name: string}>>([]);
  const [showCustomerSelector, setShowCustomerSelector] = useState(false);
  const [selectedCustomerForNewSession, setSelectedCustomerForNewSession] = useState<string>('');

  // Phase 23: Load current authenticated user
  useEffect(() => {
    async function initUser() {
      const user = await getCurrentUser();
      setCurrentUser(user);
      if (!user) {
        console.warn('[DocumentWorkspace] No authenticated user found');
      } else {
        console.log('[DocumentWorkspace] Authenticated user:', user.name, user.role);
      }
    }
    initUser();
  }, []);

  // Phase 30.1: Load persisted dynamic templates from database
  useEffect(() => {
    async function loadDynamicTemplates() {
      try {
        const { loadTemplatesFromSource } = await import('../templates/registry');
        await loadTemplatesFromSource();
        console.log('[DocumentWorkspace] Dynamic templates loaded');
      } catch (err) {
        console.error('[DocumentWorkspace] Error loading dynamic templates:', err);
        // Don't block app - continue with static templates
      }
    }
    loadDynamicTemplates();
  }, []);
  
  // Phase 31.5: Load available customers for session creation
  useEffect(() => {
    async function loadCustomers() {
      try {
        const { getCustomers } = await import('../../customer/customerService');
        const customers = await getCustomers();
        setAvailableCustomers(customers.map(c => ({ id: c.id, name: c.name })));
        console.log(`[DocumentWorkspace] Loaded ${customers.length} customers for selection`);
      } catch (err) {
        console.error('[DocumentWorkspace] Error loading customers:', err);
      }
    }
    loadCustomers();
  }, []);
  
  // Phase 25: Load version history when activeStep changes
  useEffect(() => {
    async function loadVersionHistory() {
      if (activeStep && activeSessionId) {
        const docId = generateDocumentId(activeSessionId, activeStep);
        const versions = await getVersions(docId);
        if (versions.length > 0) {
          setDocumentVersions(prev => ({ ...prev, [activeStep]: versions }));
        }
      }
    }
    loadVersionHistory();
  }, [activeStep, activeSessionId]);

  // Phase 28: Check package export eligibility when documents change
  useEffect(() => {
    async function checkEligibility() {
      if (!activeSessionId) {
        setPackageEligibility(null);
        return;
      }

      try {
        const { checkExportEligibility } = await (0, eval)("import('../export/packageExporter')");
        const eligibility = await checkExportEligibility(
          activeSessionId,
          documents,
          documentMeta,
          validationResults
        );
        setPackageEligibility({
          isEligible: eligibility.isEligible,
          message: eligibility.message
        });
      } catch (err) {
        console.error('[DocumentWorkspace] Error checking export eligibility:', err);
      }
    }

    checkEligibility();
  }, [activeSessionId, documents, documentMeta, validationResults]);

  // Phase 31: Load customer and templates when active session changes
  useEffect(() => {
    async function loadCustomerTemplates() {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (!activeSession?.data.customerId) {
        setCustomerName(null);
        setCustomerTemplates([]);
        return;
      }

      try {
        const { getCustomerById, getTemplatesForCustomer } = await import('../../customer/customerService');
        
        const customer = await getCustomerById(activeSession.data.customerId);
        if (customer) {
          setCustomerName(customer.name);
          
          const templates = await getTemplatesForCustomer(customer.id);
          setCustomerTemplates(templates);
          
          console.log(`[DocumentWorkspace] Loaded ${templates.length} templates for customer: ${customer.name}`);
        }
      } catch (err) {
        console.error('[DocumentWorkspace] Error loading customer templates:', err);
      }
    }
    loadCustomerTemplates();
  }, [activeSessionId, sessions]);

  // Load session into workspace state
  const loadSessionIntoWorkspace = (session: StoredSession) => {
    console.log(`[DocumentWorkspace] Loading session: ${session.name}`);
    setActiveSessionId(session.id);
    
    if (session.data.bomData) {
      setNormalizedBOM(session.data.bomData);
      setDocuments(session.data.documents || {});
      setEditableDocuments(session.data.editableDocuments || {});
      setValidationResults(session.data.validationResults || {});
      setDocumentTimestamps(session.data.documentTimestamps || {});
      setDocumentMeta(session.data.documentMeta || {});
      setActiveStep(session.data.activeStep || null);
      setAppPhase('workflow');
      console.log('[DocumentWorkspace] Session loaded:', Object.keys(session.data.documents || {}).length, 'documents');
    } else {
      setAppPhase('upload');
      setNormalizedBOM(null);
      setActiveStep(null);
      setDocuments({});
      setEditableDocuments({});
      setValidationResults({});
      setDocumentTimestamps({});
      setDocumentMeta({});
    }
    
    setRegenMessage(null);
    setPrereqWarning(null);
    setError(null);
  };

  // Load sessions on mount + migrate localStorage if needed
  useEffect(() => {
    async function initSessions() {
      try {
        setIsLoading(true);
        
        // Phase 22: Migrate localStorage sessions to database
        const migratedCount = await migrateLocalStorageSessions();
        if (migratedCount > 0) {
          console.log(`[DocumentWorkspace] Migrated ${migratedCount} sessions from localStorage`);
        }
        
        // Load sessions from database (filtered by ppapId if provided)
        const loadedSessions = await loadSessions(ppapId || null);
        setSessions(loadedSessions);
        
        if (loadedSessions.length > 0) {
          // Auto-load the first session
          const firstSession = loadedSessions[0];
          loadSessionIntoWorkspace(firstSession);
        }
      } catch (err) {
        console.error('[DocumentWorkspace] Failed to initialize sessions:', err);
        setError('Failed to load sessions from database');
      } finally {
        setIsLoading(false);
      }
    }
    
    initSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ppapId]);

  // Auto-save active session on state changes
  useEffect(() => {
    if (appPhase === 'workflow' && normalizedBOM && activeSessionId && !isLoading) {
      const sessionData: PPAPSession = {
        bomData: normalizedBOM,
        documents,
        editableDocuments,
        validationResults,
        documentTimestamps,
        documentMeta,
        activeStep
      };
      
      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (activeSession) {
        const updatedSession: StoredSession = {
          ...activeSession,
          data: sessionData
        };
        
        // Auto-save to database only (don't update local sessions array)
        saveSession(updatedSession).then(success => {
          if (!success) {
            setSaveError('Failed to save session');
            // Retry once after 1 second
            setTimeout(() => {
              saveSession(updatedSession).then(retrySuccess => {
                if (retrySuccess) {
                  setSaveError(null);
                  console.log('[DocumentWorkspace] Session saved on retry');
                }
              });
            }, 1000);
          } else {
            setSaveError(null);
          }
        }).catch(err => {
          console.error('[DocumentWorkspace] Auto-save error:', err);
          setSaveError('Failed to save session');
        });
      }
    }
  }, [normalizedBOM, documents, editableDocuments, validationResults, documentTimestamps, documentMeta, activeStep, appPhase, activeSessionId, isLoading, sessions]);

  // Phase 31.5: Session creation with customer selector
  const handleCreateNewSession = () => {
    setShowCustomerSelector(true);
  };
  
  const createNewSessionWithCustomer = async () => {
    const sessionName = `Session ${sessions.length + 1}`;
    const customerId = selectedCustomerForNewSession || undefined;
    const newSession = await createSession(sessionName, currentUser?.id || null, customerId);
    if (newSession) {
      const allSessions = await loadSessions();
      setSessions(allSessions);
      loadSessionIntoWorkspace(newSession);
      setShowCustomerSelector(false);
      setSelectedCustomerForNewSession('');
    }
  };
  
  const cancelCustomerSelection = () => {
    setShowCustomerSelector(false);
    setSelectedCustomerForNewSession('');
  };

  const handleBOMProcessed = async (text: string) => {
    try {
      setError(null);
      console.log('[DocumentWorkspace] Parsing BOM text...');
      const parsed = parseBOMText(text);
      console.log('[DocumentWorkspace] Normalizing BOM data...');
      const normalized = normalizeBOMData(parsed);
      
      // If no active session exists, create one automatically
      if (!activeSessionId) {
        console.log('[DocumentWorkspace] No active session - creating new session for BOM');
        const sessionName = `Session ${new Date().toLocaleString()}`;
        const newSession = await createSession(sessionName, currentUser?.id || null, ppapId || null);
        
        if (!newSession) {
          setError('Failed to create session for BOM data');
          return;
        }
        
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(newSession.id);
        console.log('[DocumentWorkspace] Auto-created session:', newSession.name);
      }
      
      setNormalizedBOM(normalized);
      setAppPhase('workflow');
      console.log('[DocumentWorkspace] BOM processed:', normalized.masterPartNumber);
      console.log(`[DocumentWorkspace] Found ${normalized.summary.totalOperations} operations, ${normalized.summary.totalComponents} components`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process BOM');
      console.error('[DocumentWorkspace] Error processing BOM:', err);
    }
  };

  // Phase 31.5: Get available template IDs based on customer assignment
  const getAvailableTemplateIds = (): string[] => {
    // If session has customer and customer has templates assigned, use those
    if (customerTemplates.length > 0) {
      console.log(`[DocumentWorkspace] Using ${customerTemplates.length} customer templates`);
      return customerTemplates;
    }
    
    // Otherwise, get all available templates (static + dynamic)
    try {
      const { listTemplates } = require('../templates/registry');
      const allTemplates = listTemplates();
      const templateIds = allTemplates.map((t: any) => t.id);
      console.log(`[DocumentWorkspace] Using ${templateIds.length} default templates`);
      return templateIds;
    } catch (err) {
      console.error('[DocumentWorkspace] Error loading templates:', err);
      // Fallback to static templates only
      return ['PSW', 'PROCESS_FLOW', 'PFMEA', 'CONTROL_PLAN'];
    }
  };
  
  // Phase 31.5: Check if a template is available for this session
  const isTemplateAvailable = (templateId: string): boolean => {
    const availableIds = getAvailableTemplateIds();
    return availableIds.includes(templateId);
  };

  const generateWithBestSource = (stepId: TemplateId): { draft: DocumentDraft; actualSource: string } => {
    const stepDef = WORKFLOW_STEPS.find(s => s.id === stepId)!;
    let actualSource = 'BOM';
    let draft: DocumentDraft;

    if (stepId === 'PROCESS_FLOW') {
      // Always generate from BOM
      draft = generateDocumentDraft(stepId, { bom: normalizedBOM!, externalData: {} });
      actualSource = 'BOM';
    } else if (stepId === 'PFMEA') {
      // Use Process Flow if available, else BOM
      if (documents['PROCESS_FLOW']) {
        const processFlow = mapBOMToProcessFlow(normalizedBOM!);
        const pfmea = mapProcessFlowToPFMEA(processFlow);
        draft = {
          templateId: 'PFMEA',
          metadata: {
            generatedAt: new Date().toISOString(),
            bomMasterPartNumber: normalizedBOM!.masterPartNumber,
            templateVersion: '1.0'
          },
          fields: {
            partNumber: pfmea.partNumber,
            rows: pfmea.rows
          }
        };
        actualSource = 'Process Flow';
      } else {
        draft = generateDocumentDraft(stepId, { bom: normalizedBOM!, externalData: {} });
        actualSource = 'BOM (no Process Flow available)';
      }
    } else if (stepId === 'CONTROL_PLAN') {
      // Use PFMEA if available, else BOM chain
      if (documents['PFMEA']) {
        const processFlow = mapBOMToProcessFlow(normalizedBOM!);
        const pfmea = mapProcessFlowToPFMEA(processFlow);
        const controlPlan = mapPFMEAToControlPlan(pfmea);
        draft = {
          templateId: 'CONTROL_PLAN',
          metadata: {
            generatedAt: new Date().toISOString(),
            bomMasterPartNumber: normalizedBOM!.masterPartNumber,
            templateVersion: '1.0'
          },
          fields: {
            partNumber: controlPlan.partNumber,
            rows: controlPlan.rows
          }
        };
        actualSource = 'PFMEA';
      } else {
        draft = generateDocumentDraft(stepId, { bom: normalizedBOM!, externalData: {} });
        actualSource = 'BOM (no PFMEA available)';
      }
    } else {
      // PSW and others: use BOM
      draft = generateDocumentDraft(stepId, { bom: normalizedBOM!, externalData: {} });
      actualSource = 'BOM';
    }

    return { draft, actualSource };
  };

  const isStepEnabled = (stepId: TemplateId): boolean => {
    const step = WORKFLOW_STEPS.find(s => s.id === stepId);
    if (!step) return false;
    
    // Phase 31.5: Check if template is available for this session
    if (!isTemplateAvailable(stepId)) {
      return false;
    }
    
    // Step is enabled if all dependencies are satisfied
    return step.dependsOn.every(dep => !!documents[dep]);
  };

  const handleStepClick = async (stepId: TemplateId) => {
    if (!normalizedBOM) return;
    
    const stepDef = WORKFLOW_STEPS.find(s => s.id === stepId)!;
    const label = stepDef.label;
    const isRegen = !!documents[stepId];
    const enabled = isStepEnabled(stepId);
    
    // Allow navigation to existing documents even if not enabled
    if (isRegen) {
      setActiveStep(stepId);
      setRegenMessage(null);
      setPrereqWarning(null);
      setError(null);
      return;
    }
    
    // Block generation if dependencies not met
    if (!enabled) {
      const missingDeps = stepDef.dependsOn.filter(dep => !documents[dep]);
      const depLabels = missingDeps.map(dep => WORKFLOW_STEPS.find(s => s.id === dep)?.label).join(', ');
      setError(`Cannot generate ${label}: Please complete ${depLabels} first`);
      setPrereqWarning(null);
      setRegenMessage(null);
      console.log(`[DocumentWorkspace] Generation blocked: ${label} requires ${depLabels}`);
      return;
    }
    
    try {
      setError(null);
      setPrereqWarning(null);
      const hasEdits = editableDocuments[stepId] && hasChanges();

      // Note: isRegen is false here due to early return above

      const now = Date.now();
      const { draft, actualSource } = generateWithBestSource(stepId);
      const msg = `${isRegen ? 'Regenerating' : 'Generating'} ${label} from ${actualSource}`;
      setRegenMessage(msg);

      console.log(`[DocumentWorkspace] ${msg}`);
      const editableCopy = structuredClone(draft);
      const template = getTemplate(stepId);
      const validation = validateDocument(editableCopy, template);

      setDocuments(prev => ({ ...prev, [stepId]: draft }));
      setEditableDocuments(prev => ({ ...prev, [stepId]: editableCopy }));
      setValidationResults(prev => ({ ...prev, [stepId]: validation }));
      setDocumentTimestamps(prev => ({ ...prev, [stepId]: now }));
      
      // Initialize metadata for new document
      if (!documentMeta[stepId] && currentUser) {
        setDocumentMeta(prev => ({
          ...prev,
          [stepId]: {
            ownerId: currentUser.id,
            ownerName: currentUser.name,
            status: 'draft'
          }
        }));
      }
      
      // Phase 24: Create version on generation
      if (activeSessionId && currentUser) {
        const docId = generateDocumentId(activeSessionId, stepId);
        const metadata = documentMeta[stepId] || {
          ownerId: currentUser.id,
          ownerName: currentUser.name,
          status: 'draft' as DocumentStatus
        };
        
        const version = await createVersion(
          docId,
          activeSessionId,
          stepId,
          draft,
          editableCopy,
          metadata,
          currentUser.id
        );
        
        if (version) {
          setCurrentVersionNumbers(prev => ({ ...prev, [stepId]: version.versionNumber }));
          console.log(`[DocumentWorkspace] Created version ${version.versionNumber} for ${stepId}`);
          
          // Phase 25: Load version history after creating version
          const versions = await getVersions(docId);
          setDocumentVersions(prev => ({ ...prev, [stepId]: versions }));
        }
      }
      
      setActiveStep(stepId);

      console.log(`[DocumentWorkspace] ${stepId} generated:`, validation.isValid ? 'Valid' : `${validation.errors.length} errors`);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to generate ${stepId}`);
      setRegenMessage(null);
      setPrereqWarning(null);
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

  const createNewSession = async () => {
    const name = window.prompt('Enter session name:');
    if (!name || !name.trim()) return;
    
    try {
      const newSession = await createSession(name.trim(), ppapId || null, currentUser?.id || null);
      if (!newSession) {
        setError('Failed to create session');
        return;
      }
      
      const updatedSessions = [...sessions, newSession];
      setSessions(updatedSessions);
      loadSessionIntoWorkspace(newSession);
      console.log(`[DocumentWorkspace] Created new session: ${name}`);
    } catch (err) {
      console.error('[DocumentWorkspace] Error creating session:', err);
      setError('Failed to create session');
    }
  };
  
  const handleDeleteSession = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const confirmed = window.confirm(
      `Delete session "${session.name}"? This cannot be undone.`
    );
    if (!confirmed) return;
    
    try {
      const success = await deleteSessionDB(sessionId);
      if (!success) {
        setError('Failed to delete session');
        return;
      }
      
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      setSessions(updatedSessions);
      
      // If deleting active session, switch to first available or create new
      if (sessionId === activeSessionId) {
        if (updatedSessions.length > 0) {
          loadSessionIntoWorkspace(updatedSessions[0]);
        } else {
          setActiveSessionId(null);
          setAppPhase('upload');
          setNormalizedBOM(null);
          setActiveStep(null);
          setDocuments({});
          setEditableDocuments({});
          setValidationResults({});
          setDocumentTimestamps({});
          setDocumentMeta({});
        }
      }
      
      console.log(`[DocumentWorkspace] Deleted session: ${session.name}`);
    } catch (err) {
      console.error('[DocumentWorkspace] Error deleting session:', err);
      setError('Failed to delete session');
    }
  };
  
  // Phase 25: Helper functions for version operations
  const isCurrentVersionApproved = (templateId: TemplateId): boolean => {
    return documentMeta[templateId]?.status === 'approved';
  };
  
  const switchToVersion = async (templateId: TemplateId, versionNumber: number) => {
    if (!activeSessionId) return;
    
    const docId = generateDocumentId(activeSessionId, templateId);
    const version = await getVersions(docId).then(versions => 
      versions.find(v => v.versionNumber === versionNumber)
    );
    
    if (!version) {
      setError('Version not found');
      return;
    }
    
    // Load version data into UI (read-only)
    setDocuments(prev => ({ ...prev, [templateId]: version.documentData }));
    setEditableDocuments(prev => ({ ...prev, [templateId]: version.editableData }));
    setDocumentMeta(prev => ({ ...prev, [templateId]: version.metadata }));
    setViewingVersionNumber(prev => ({ ...prev, [templateId]: versionNumber }));
    setIsViewingOldVersion(versionNumber !== currentVersionNumbers[templateId]);
    
    console.log(`[DocumentWorkspace] Switched to version ${versionNumber} for ${templateId}`);
  };
  
  const returnToLatestVersion = async (templateId: TemplateId) => {
    if (!activeSessionId) return;
    
    const docId = generateDocumentId(activeSessionId, templateId);
    const latestVersion = await getVersions(docId).then(versions => versions[0]);
    
    if (!latestVersion) return;
    
    // Reload latest version
    setDocuments(prev => ({ ...prev, [templateId]: latestVersion.documentData }));
    setEditableDocuments(prev => ({ ...prev, [templateId]: latestVersion.editableData }));
    setDocumentMeta(prev => ({ ...prev, [templateId]: latestVersion.metadata }));
    setViewingVersionNumber(prev => ({ ...prev, [templateId]: null }));
    setIsViewingOldVersion(false);
    
    console.log(`[DocumentWorkspace] Returned to latest version for ${templateId}`);
  };
  
  const createNewRevision = async (templateId: TemplateId) => {
    if (!activeSessionId || !currentUser) return;
    
    // Clone current document
    const currentDoc = documents[templateId];
    const currentEditable = editableDocuments[templateId];
    
    if (!currentDoc || !currentEditable) {
      setError('No document to create revision from');
      return;
    }
    
    // Create new metadata with draft status
    const newMetadata: DocumentMetadata = {
      ownerId: currentUser.id,
      ownerName: currentUser.name,
      status: 'draft'
    };
    
    // Create new version
    const docId = generateDocumentId(activeSessionId, templateId);
    const version = await createVersion(
      docId,
      activeSessionId,
      templateId,
      currentDoc,
      currentEditable,
      newMetadata,
      currentUser.id
    );
    
    if (version) {
      setCurrentVersionNumbers(prev => ({ ...prev, [templateId]: version.versionNumber }));
      setDocumentMeta(prev => ({ ...prev, [templateId]: newMetadata }));
      setViewingVersionNumber(prev => ({ ...prev, [templateId]: null }));
      setIsViewingOldVersion(false);
      
      // Reload version history
      const versions = await getVersions(docId);
      setDocumentVersions(prev => ({ ...prev, [templateId]: versions }));
      
      console.log(`[DocumentWorkspace] Created new revision ${version.versionNumber} for ${templateId}`);
    }
  };

  const resetSession = async () => {
    if (!activeSessionId) return;
    
    const confirmed = window.confirm(
      'This will clear all documents and reset the current session. Continue?'
    );
    if (!confirmed) return;

    const activeSession = sessions.find(s => s.id === activeSessionId);
    if (!activeSession) return;
    
    const emptyData: PPAPSession = {
      bomData: null,
      documents: {},
      editableDocuments: {},
      validationResults: {},
      documentTimestamps: {},
      documentMeta: {},
      activeStep: null
    };
    
    const updatedSession: StoredSession = {
      ...activeSession,
      data: emptyData
    };
    
    try {
      const success = await saveSession(updatedSession);
      if (!success) {
        setError('Failed to reset session');
        return;
      }
      
      const updatedSessions = sessions.map(s => 
        s.id === activeSessionId ? updatedSession : s
      );
      setSessions(updatedSessions);
      
      setAppPhase('upload');
      setNormalizedBOM(null);
      setActiveStep(null);
      setDocuments({});
      setEditableDocuments({});
      setValidationResults({});
      setDocumentTimestamps({});
      setDocumentMeta({});
      setRegenMessage(null);
      setPrereqWarning(null);
      setError(null);
      console.log('[DocumentWorkspace] Session reset');
    } catch (err) {
      console.error('[DocumentWorkspace] Error resetting session:', err);
      setError('Failed to reset session');
    }
  };

  const handleResetWorkspace = () => {
    resetSession();
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
    const currentVal = validationResults[activeStep];
    const currentMeta = documentMeta[activeStep];
    
    // Block export if validation fails
    if (currentVal && !currentVal.isValid) {
      setError(`Cannot export ${activeStep}: Document has ${currentVal.errors.length} validation error(s) that must be resolved first`);
      console.log(`[DocumentWorkspace] Export blocked: validation errors present`);
      return;
    }
    
    // Block export if not approved
    if (currentMeta?.status !== 'approved') {
      setError(`Cannot export ${activeStep}: Document must be approved before export (current status: ${currentMeta?.status || 'draft'})`);
      console.log(`[DocumentWorkspace] Export blocked: document not approved`);
      return;
    }
    
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

  // Phase 28: Export complete PPAP package
  const handleExportPackage = async () => {
    if (!activeSessionId || !packageEligibility?.isEligible) {
      setError(packageEligibility?.message || 'Cannot export PPAP package');
      return;
    }

    setIsExportingPackage(true);
    setError(null);

    try {
      console.log('[DocumentWorkspace] Exporting PPAP package...');
      
      const packageModule = await (0, eval)("import('../export/packageExporter')");
      const { getApprovedDocuments, generatePackagePDF, downloadPackage } = packageModule;

      // Get all approved documents
      const approvedDocs = await getApprovedDocuments(activeSessionId, documents, documentMeta);
      
      if (approvedDocs.length === 0) {
        setError('No approved documents found for export');
        setIsExportingPackage(false);
        return;
      }

      console.log(`[DocumentWorkspace] Generating package with ${approvedDocs.length} documents...`);

      // Generate combined PDF
      const activeSession = sessions.find(s => s.id === activeSessionId);
      const sessionName = activeSession?.name || 'PPAP-Session';
      const pdfBytes = await generatePackagePDF(approvedDocs, sessionName);

      // Download
      downloadPackage(pdfBytes, sessionName);
      
      console.log('[DocumentWorkspace] PPAP package exported successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export PPAP package');
      console.error('[DocumentWorkspace] Error exporting package:', err);
    } finally {
      setIsExportingPackage(false);
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

  const recommendedStep = STEP_ORDER.find(stepId => {
    const step = WORKFLOW_STEPS.find(s => s.id === stepId);
    if (!step) return false;
    return !documents[stepId] && step.dependsOn.every(dep => !!documents[dep]);
  });

  const getGuidanceMessage = (): string => {
    if (!recommendedStep) {
      const allGenerated = STEP_ORDER.every(id => !!documents[id]);
      if (allGenerated) return 'All documents generated';
      return 'Continue generating documents';
    }
    const stepDef = WORKFLOW_STEPS.find(s => s.id === recommendedStep)!;
    const desc = STEP_DESCRIPTION[recommendedStep] ?? '';
    if (recommendedStep === 'PROCESS_FLOW') {
      return `Start by generating ${stepDef.label} — ${desc}`;
    }
    return `Next: Generate ${stepDef.label} — ${desc}`;
  };

  const allStepsGenerated = STEP_ORDER.every(stepId => !!documents[stepId]);
  const allStepsValid = STEP_ORDER.every(stepId => {
    const result = validationResults[stepId];
    return result && result.isValid;
  });
  const allStepsApproved = STEP_ORDER.every(stepId => {
    const meta = documentMeta[stepId];
    return meta?.status === 'approved';
  });
  const ppapReady = allStepsGenerated && allStepsValid && allStepsApproved;

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Document Workspace</h1>
        <p className="text-gray-600">Generate PPAP documents from BOM data</p>
      </div>

      {/* Session Selector */}
      {sessions.length > 0 && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <label className="text-sm font-semibold text-gray-700">Session:</label>
              <select
                value={activeSessionId || ''}
                onChange={(e) => {
                  const session = sessions.find(s => s.id === e.target.value);
                  if (session) loadSessionIntoWorkspace(session);
                }}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {session.name} {session.data.bomData ? `(${Object.keys(session.data.documents || {}).length} docs)` : '(empty)'}
                  </option>
                ))}
              </select>
              {activeSession && (
                <span className="text-xs text-gray-500">
                  Active: <strong>{activeSession.name}</strong>
                </span>
              )}
              {/* Phase 31: Customer indicator */}
              {customerName && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                  Customer: {customerName}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={createNewSession}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                + New Session
              </button>
              {activeSessionId && sessions.length > 1 && (
                <button
                  onClick={() => activeSessionId && handleDeleteSession(activeSessionId)}
                  className="px-3 py-2 bg-red-50 text-red-700 text-sm font-medium rounded-md hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              )}
              {/* Phase 28: Export PPAP Package */}
              {activeSessionId && packageEligibility && (
                <button
                  onClick={handleExportPackage}
                  disabled={!packageEligibility.isEligible || isExportingPackage}
                  title={packageEligibility.message}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    packageEligibility.isEligible && !isExportingPackage
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {isExportingPackage ? '⏳ Exporting...' : '📦 Export PPAP Package'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Session Button (if no sessions exist) */}
      {sessions.length === 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-blue-800 font-semibold mb-1">No Sessions Found</h4>
              <p className="text-sm text-blue-700">Create your first PPAP session to get started</p>
            </div>
            <button
              onClick={handleCreateNewSession}
              className="px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Create First Session
            </button>
          </div>
        </div>
      )}

      {/* Phase 31.5: Customer Selector Modal */}
      {showCustomerSelector && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Create New Session</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Customer (Optional)
              </label>
              <select
                value={selectedCustomerForNewSession}
                onChange={(e) => setSelectedCustomerForNewSession(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">No Customer (Use All Templates)</option>
                {availableCustomers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-600">
                {selectedCustomerForNewSession 
                  ? 'Session will use templates assigned to this customer'
                  : 'Session will have access to all available templates'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={createNewSessionWithCustomer}
                className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Session
              </button>
              <button
                onClick={cancelCustomerSelection}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-medium rounded-md hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-semibold mb-1">Error</h4>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}
      
      {/* Save Error Notification */}
      {saveError && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-yellow-800 font-semibold mb-1">⚠️ Save Warning</h4>
          <p className="text-yellow-700 text-sm">{saveError} - Retrying automatically...</p>
        </div>
      )}
      
      {/* Loading Indicator */}
      {isLoading && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-700 text-sm">Loading sessions from database...</p>
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
                <div className="flex-1">
                  <h4 className="text-green-800 font-semibold mb-1">BOM Loaded</h4>
                  <div className="text-sm text-green-700 flex gap-6">
                    <span>Part: <strong>{normalizedBOM.masterPartNumber}</strong></span>
                    <span>Operations: <strong>{normalizedBOM.summary.totalOperations}</strong></span>
                    <span>Components: <strong>{normalizedBOM.summary.totalComponents}</strong> ({normalizedBOM.summary.wires}W / {normalizedBOM.summary.terminals}T / {normalizedBOM.summary.hardware}H)</span>
                  </div>
                  {/* Phase 31.5: Template source indicator */}
                  <div className="text-sm text-green-700 mt-2 flex items-center gap-2">
                    {customerName && customerTemplates.length > 0 ? (
                      <>
                        <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                          Using {customerName} Templates
                        </span>
                        <span>({customerTemplates.length} templates available)</span>
                      </>
                    ) : (
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                        Using Default Templates
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleResetWorkspace}
                    className="text-sm text-red-600 hover:text-red-800 font-medium underline"
                  >
                    Reset Session
                  </button>
                  <button
                    onClick={handleResetWorkspace}
                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    Load New BOM
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PPAP Readiness Indicator */}
          {allStepsGenerated && (
            <div className={`mb-6 border rounded-lg p-4 ${
              ppapReady
                ? 'bg-green-50 border-green-300'
                : 'bg-yellow-50 border-yellow-300'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {ppapReady ? '✅' : '⚠️'}
                  </span>
                  <div>
                    <h4 className={`font-bold ${
                      ppapReady ? 'text-green-800' : 'text-yellow-800'
                    }`}>
                      {ppapReady ? 'PPAP Package Ready' : 'PPAP Package Incomplete'}
                    </h4>
                    <p className={`text-sm ${
                      ppapReady ? 'text-green-700' : 'text-yellow-700'
                    }`}>
                      {ppapReady
                        ? 'All documents generated, validated, and approved. Ready for submission.'
                        : 'All documents generated, but validation and/or approval requirements must be met before submission.'}
                    </p>
                  </div>
                </div>
                {!ppapReady && (
                  <div className="text-sm text-yellow-700 space-y-1">
                    {STEP_ORDER.filter(id => {
                      const result = validationResults[id];
                      return !result || !result.isValid;
                    }).length > 0 && (
                      <div>
                        <strong>
                          {STEP_ORDER.filter(id => {
                            const result = validationResults[id];
                            return !result || !result.isValid;
                          }).length}
                        </strong> document(s) with validation errors
                      </div>
                    )}
                    {STEP_ORDER.filter(id => {
                      const meta = documentMeta[id];
                      return meta?.status !== 'approved';
                    }).length > 0 && (
                      <div>
                        <strong>
                          {STEP_ORDER.filter(id => {
                            const meta = documentMeta[id];
                            return meta?.status !== 'approved';
                          }).length}
                        </strong> document(s) awaiting approval
                      </div>
                    )}
                  </div>
                )}
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
                    const isRecommended = recommendedStep === step.id;
                    const stepDesc = STEP_DESCRIPTION[step.id];
                    const enabled = isStepEnabled(step.id);
                    const completionIcon = isGenerated && !stale ? '✓' : stale ? '⚠' : '○';
                    const isBlocked = !enabled && !isGenerated;
                    const meta = documentMeta[step.id];
                    const statusBadge = meta?.status === 'approved' ? '✅' : meta?.status === 'in_review' ? '⏳' : meta?.status === 'draft' ? '📝' : '';
                    return (
                      <div key={step.id}>
                        <button
                          onClick={() => handleStepClick(step.id)}
                          disabled={isBlocked}
                          className={`w-full text-left rounded-md px-3 py-2.5 transition-all ${
                            isActive
                              ? 'bg-blue-600 text-white shadow-md'
                              : isRecommended
                              ? 'bg-indigo-100 text-indigo-900 border-2 border-indigo-400 hover:bg-indigo-200 shadow-lg'
                              : isBlocked
                              ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed opacity-60'
                              : stale
                              ? 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
                              : isGenerated
                              ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                              : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className={`font-semibold ${activeStep === step.id ? 'text-blue-700' : 'text-gray-900'}`}>
                              {step.label}
                            </span>
                            <div className="flex items-center gap-2">
                              {!isTemplateAvailable(step.id) && (
                                <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                                  Not Available
                                </span>
                              )}
                              {documents[step.id] && (
                                <span className={`text-xs px-2 py-1 rounded ${
                                  validationResults[step.id]?.isValid
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {validationResults[step.id]?.isValid ? '✓ Valid' : '⚠ Issues'}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              isActive
                                ? 'bg-white text-blue-600'
                                : isRecommended
                                ? 'bg-indigo-600 text-white'
                                : isBlocked
                                ? 'bg-gray-300 text-gray-500'
                                : stale
                                ? 'bg-orange-400 text-white'
                                : isGenerated
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-300 text-gray-600'
                            }`}>
                              {isBlocked ? '🔒' : isRecommended ? '→' : index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-sm leading-tight">{step.label}</span>
                                {isRecommended && (
                                  <span className="text-xs font-bold text-indigo-600 bg-indigo-200 px-1.5 py-0.5 rounded">NEXT</span>
                                )}
                              </div>
                              <div className={`text-xs mt-0.5 ${
                                isActive ? 'text-blue-100' : isRecommended ? 'text-indigo-700' : stale ? 'text-orange-600' : isGenerated ? 'text-green-600' : 'text-gray-400'
                              }`}>
                                {completionIcon} {stepDesc}
                              </div>
                              {depLabel && !isRecommended && (
                                <div className={`text-xs mt-0.5 ${
                                  isActive ? 'text-blue-200' : 'text-gray-400'
                                }`}>
                                  {depLabel}
                                </div>
                              )}
                              {meta && isGenerated && (
                                <div className="mt-1 space-y-0.5">
                                  {meta.ownerName && (
                                    <div className="text-xs text-gray-500">
                                      👤 {meta.ownerName}
                                    </div>
                                  )}
                                  <div className={`text-xs font-medium ${
                                    meta.status === 'approved' ? 'text-green-700' :
                                    meta.status === 'in_review' ? 'text-yellow-700' :
                                    'text-gray-600'
                                  }`}>
                                    {statusBadge} {meta.status === 'approved' ? 'Approved' : meta.status === 'in_review' ? 'In Review' : 'Draft'}
                                  </div>
                                  {meta.status === 'approved' && meta.approvedByName && (
                                    <div className="text-xs text-green-600">
                                      ✓ by {meta.approvedByName}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          {isBlocked && missingDeps.length > 0 && (
                            <div className="mt-1.5 text-xs text-red-700 bg-red-50 rounded px-2 py-1 font-medium">
                              🔒 Requires {missingDeps.map(d => d.label).join(', ')}
                            </div>
                          )}
                          {stale && !isActive && (
                            <div className="mt-1.5 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                              ⚠ May be out of sync with {deps.map(d => d.label).join(', ')}
                            </div>
                          )}
                          {!stale && deps.length > 0 && deps.every(d => d.exists) && !isActive && isGenerated && !isRecommended && (
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
              {/* Guidance Banner */}
              {!activeStep && (
                <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-600 text-lg">👉</span>
                    <span className="text-indigo-900 font-medium">{getGuidanceMessage()}</span>
                  </div>
                </div>
              )}

              {/* Prerequisite Warning */}
              {prereqWarning && (
                <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 flex items-center gap-2">
                  <span className="text-amber-600 text-sm">⚠</span>
                  <span className="text-amber-800 text-sm">{prereqWarning}</span>
                </div>
              )}

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

              {/* Owner and Status Controls */}
              {currentEditableDraft && activeStep && (
                <div className="bg-white rounded-lg shadow-md p-4 mb-4 border-l-4 border-blue-500">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700">Owner:</label>
                      <span className="text-sm font-medium text-gray-900">
                        {documentMeta[activeStep]?.ownerName || currentUser?.name || 'Unknown'}
                      </span>
                      {currentUser && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(currentUser.role)}`}>
                          {getRoleDisplayName(currentUser.role)}
                        </span>
                      )}
                    </div>
                    {currentVersionNumbers[activeStep] && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-gray-700">Version:</label>
                        <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded text-sm font-medium text-blue-800">
                          v{currentVersionNumbers[activeStep]}
                        </span>
                        {documentVersions[activeStep] && documentVersions[activeStep].length > 1 && (
                          <button
                            onClick={() => setShowVersionHistory(prev => ({ ...prev, [activeStep]: !prev[activeStep] }))}
                            className="px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                          >
                            {showVersionHistory[activeStep] ? 'Hide History' : 'Show History'}
                          </button>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Status:</label>
                      <select
                        value={documentMeta[activeStep]?.status || 'draft'}
                        disabled={isViewingOldVersion || isCurrentVersionApproved(activeStep)}
                        onChange={async (e) => {
                          const newStatus = e.target.value as DocumentStatus;
                          if (newStatus === 'approved' && currentUser && !canApprove(currentUser.role)) {
                            setError(`Only QA, Manager, or Admin can approve documents. Your role: ${getRoleDisplayName(currentUser.role)}`);
                            return;
                          }
                          
                          const updatedMetadata = {
                            ...documentMeta[activeStep],
                            ownerId: documentMeta[activeStep]?.ownerId || currentUser?.id || '',
                            ownerName: documentMeta[activeStep]?.ownerName || currentUser?.name,
                            status: newStatus,
                            approvedBy: newStatus === 'approved' ? currentUser?.id : documentMeta[activeStep]?.approvedBy,
                            approvedByName: newStatus === 'approved' ? currentUser?.name : documentMeta[activeStep]?.approvedByName,
                            approvedAt: newStatus === 'approved' ? Date.now() : documentMeta[activeStep]?.approvedAt,
                          };
                          
                          setDocumentMeta(prev => ({
                            ...prev,
                            [activeStep]: updatedMetadata
                          }));
                          
                          // Phase 24: Create version on approval
                          if (newStatus === 'approved' && activeSessionId && currentUser) {
                            const docId = generateDocumentId(activeSessionId, activeStep);
                            const version = await createVersion(
                              docId,
                              activeSessionId,
                              activeStep,
                              documents[activeStep],
                              editableDocuments[activeStep],
                              updatedMetadata,
                              currentUser.id
                            );
                            
                            if (version) {
                              setCurrentVersionNumbers(prev => ({ ...prev, [activeStep]: version.versionNumber }));
                              console.log(`[DocumentWorkspace] Created approved version ${version.versionNumber} for ${activeStep}`);
                            }
                          }
                        }}
                        className={`px-3 py-2 border rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          documentMeta[activeStep]?.status === 'approved'
                            ? 'bg-green-50 border-green-300 text-green-800'
                            : documentMeta[activeStep]?.status === 'in_review'
                            ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
                            : 'bg-gray-50 border-gray-300 text-gray-700'
                        }`}
                      >
                        <option value="draft">Draft</option>
                        <option value="in_review">In Review</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>
                    {documentMeta[activeStep]?.status === 'approved' && documentMeta[activeStep]?.approvedByName && (
                      <div className="text-xs text-green-700 flex items-center gap-1">
                        <span>✓ Approved by {documentMeta[activeStep].approvedByName}</span>
                        {documentMeta[activeStep]?.approvedAt && (
                          <span className="text-gray-500">
                            ({new Date(documentMeta[activeStep].approvedAt!).toLocaleDateString()})
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {currentUser && !canApprove(currentUser.role) && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded px-3 py-2">
                      ℹ️ Your role ({getRoleDisplayName(currentUser.role)}) does not have approval authority. Only QA, Manager, or Admin can approve documents.
                    </div>
                  )}
                  
                  {/* Phase 25: Approval Lock Banner */}
                  {isCurrentVersionApproved(activeStep) && !isViewingOldVersion && (
                    <div className="mt-2 flex items-center justify-between bg-green-50 border border-green-200 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-green-800">
                          🔒 This version is approved and locked
                        </span>
                      </div>
                      <button
                        onClick={() => createNewRevision(activeStep)}
                        className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                      >
                        Create New Revision
                      </button>
                    </div>
                  )}
                  
                  {/* Phase 25: View-Only Mode Banner */}
                  {isViewingOldVersion && viewingVersionNumber[activeStep] && (
                    <div className="mt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-800">
                          👁️ Viewing Version {viewingVersionNumber[activeStep]} (Read-Only)
                        </span>
                      </div>
                      <button
                        onClick={() => returnToLatestVersion(activeStep)}
                        className="px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition-colors"
                      >
                        Return to Latest
                      </button>
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-600">
                    {documentMeta[activeStep]?.status === 'draft' && '📝 Complete and review document before submission'}
                    {documentMeta[activeStep]?.status === 'in_review' && '⏳ Awaiting approval'}
                    {documentMeta[activeStep]?.status === 'approved' && '✅ Ready for submission'}
                  </div>
                </div>
              )}
              
              {/* Phase 25: Version History Panel */}
              {currentEditableDraft && activeStep && showVersionHistory[activeStep] && documentVersions[activeStep] && (
                <div className="bg-white rounded-lg shadow-md p-4 mb-4 border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Version History</h4>
                  <div className="space-y-2">
                    {documentVersions[activeStep].map((version) => {
                      const isCurrent = version.versionNumber === currentVersionNumbers[activeStep];
                      const isViewing = version.versionNumber === viewingVersionNumber[activeStep];
                      
                      return (
                        <div
                          key={version.id}
                          className={`flex items-center justify-between p-3 rounded border ${
                            isCurrent && !isViewingOldVersion
                              ? 'border-blue-300 bg-blue-50'
                              : isViewing
                              ? 'border-blue-400 bg-blue-100'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-semibold ${
                              isCurrent && !isViewingOldVersion ? 'text-blue-800' : 'text-gray-700'
                            }`}>
                              v{version.versionNumber}
                            </span>
                            {version.isApproved && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                                Approved
                              </span>
                            )}
                            {isCurrent && !isViewingOldVersion && (
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                Current
                              </span>
                            )}
                            <div className="text-xs text-gray-500">
                              {new Date(version.createdAt).toLocaleString()}
                            </div>
                          </div>
                          {!isCurrent && (
                            <button
                              onClick={() => switchToVersion(activeStep, version.versionNumber)}
                              className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            >
                              View
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                    readOnly={isViewingOldVersion || isCurrentVersionApproved(activeStep)}
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
