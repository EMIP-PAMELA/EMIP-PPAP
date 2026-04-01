/**
 * Document Copilot Contract Types
 * V3.2F-2 Batch 1
 * 
 * All contract types for Document Copilot domain as defined in V3.2F-1.
 * These types match the V3.2F-1 specification exactly.
 */

import { RawBOMData, NormalizedBOM } from './bomTypes';
import { DocumentDraft } from '../templates/types';

// ============================================================================
// EMIP Context Types (Stub - will be replaced with real EMIP queries)
// ============================================================================

/**
 * Component information from EMIP domain
 */
export interface Component {
  id: string;
  partNumber: string;
  description: string;
  quantity: number;
  uom: string;
  category: 'wire' | 'terminal' | 'connector' | 'hardware' | 'other';
  supplier?: string;
}

/**
 * Operation information from EMIP domain
 */
export interface Operation {
  id: string;
  stepNumber: string;        // '--10', '--20', etc.
  operationCode: string;
  description: string;
  workCenter?: string;
  setupTime?: number;
  cycleTime?: number;
}

/**
 * BOM structure node from EMIP domain
 */
export interface BOMNode {
  id: string;
  parentId?: string;
  component: Component;
  children: BOMNode[];
  level: number;
}

/**
 * EMIP Context - stubbed for now, will be replaced with real EMIP queries
 * Interface is FIXED - only implementation changes when EMIP storage is built
 */
export interface EmipContext {
  ppapId: string;
  partNumber: string;
  partDescription: string;
  customerName: string;
  supplierName: string;
  
  components: Component[];
  operations: Operation[];
  bomStructure: BOMNode[];
  
  metadata: {
    source: 'emip' | 'stub';
    lastUpdated: string;
    confidence: 'high' | 'medium' | 'low';
  };
}

// ============================================================================
// Prompt Template Types
// ============================================================================

/**
 * Required inputs for prompt template
 */
export interface RequiredInputs {
  bom: boolean;             // BOM required?
  template: boolean;        // Excel template required?
  drawing: boolean;         // Engineering drawing required?
  ppapContext: boolean;     // PPAP context required?
}

/**
 * Optional inputs for prompt template
 */
export interface OptionalInputs {
  emipContext: boolean;     // EMIP data optional?
  additionalFiles: boolean; // User can upload more files?
}

/**
 * Output format specification
 */
export interface OutputFormat {
  schema: Record<string, any>;       // JSON schema for output structure
  fileFormat: 'json' | 'excel' | 'pdf';
  excelMapping?: Record<string, any>; // If fileFormat === 'excel'
}

/**
 * Validation rule for prompt template output
 */
export interface ValidationRule {
  field: string;
  type: 'required' | 'range' | 'format' | 'dependency';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  dependsOn?: string;
  errorMessage: string;
}

/**
 * Prompt Template definition
 * Replaces TemplateDefinition for AI-based generation
 */
export interface PromptTemplate {
  id: string;                 // 'pfmea' | 'controlPlan' | 'processFlow' | 'psw'
  name: string;               // 'Process FMEA'
  description: string;        // Human-readable description
  
  systemPrompt: string;       // Claude's role and output format instructions
  documentInstructions: string; // Document-type-specific instructions
  
  requiredInputs: RequiredInputs;
  optionalInputs: OptionalInputs;
  outputFormat: OutputFormat;
  validationRules: ValidationRule[];
  
  examplePrompt?: string;     // Example prompt for testing
}

// ============================================================================
// Copilot Input/Output Types
// ============================================================================

/**
 * PPAP Context for PPAP-Bound mode
 */
export interface PPAPContext {
  partNumber: string;
  customerName: string;
  revision: string;
  supplierName: string;
}

/**
 * Copilot Input Package sent to Claude API
 */
export interface CopilotInputPackage {
  // Core inputs (always present)
  bomData: {
    raw: string;              // Raw BOM text from PDF
    parsed: RawBOMData;       // Structured data from bomParser.ts
    normalized: NormalizedBOM; // Business entities from bomNormalizer.ts
  };
  
  template: {
    documentType: string;     // 'PFMEA' | 'ControlPlan' | 'ProcessFlow' | 'PSW'
    requiredFields: string[];
    outputFormat: OutputFormat;
    validationRules: ValidationRule[];
  };
  
  systemPrompt: string;       // Claude's role and output format instructions
  documentInstructions: string; // Document-type-specific instructions
  
  // Optional inputs (context-dependent)
  excelTemplate?: {
    fileName: string;
    base64Content: string;
  };
  engineeringDrawing?: {
    fileName: string;
    base64Content: string;
  };
  ppapContext?: PPAPContext;  // PPAP-Bound mode only
  emipContext?: EmipContext;  // PPAP-Bound mode only (stubbed)
}

/**
 * Copilot Draft - Claude's response with provenance metadata
 */
export interface CopilotDraft {
  type: 'draft' | 'question' | 'error';
  
  // If type === 'draft'
  documentData?: DocumentDraft;
  
  // If type === 'question'
  question?: {
    text: string;
    context: string;
    suggestedAnswers?: string[];
  };
  
  // If type === 'error'
  error?: {
    message: string;
    recoverable: boolean;
  };
  
  // AI Provenance metadata (always present)
  metadata: {
    model: string;              // 'claude-sonnet-4-20250514'
    promptTemplateId: string;   // 'pfmea'
    tokenCount: {
      input: number;
      output: number;
      total: number;
    };
    generatedAt: string;
    confidence: 'high' | 'medium' | 'low';
    uncertainFields: string[];
    assumptions: string[];
  };
}

// ============================================================================
// Copilot Session Types
// ============================================================================

/**
 * Copilot mode
 */
export type CopilotMode = 'ppap-bound' | 'standalone';

/**
 * Copilot session status
 */
export type CopilotSessionStatus = 'active' | 'awaiting-user' | 'completed' | 'error';

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Copilot Session state
 */
export interface CopilotSession {
  sessionId: string;
  mode: CopilotMode;
  status: CopilotSessionStatus;
  
  // Session context
  ppapId?: string;            // PPAP-Bound mode only
  documentType: string;       // 'PFMEA' | 'ControlPlan' | etc.
  
  // Conversation state
  conversationHistory: ConversationMessage[];
  currentDraft?: CopilotDraft;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============================================================================
// Event Types (V3.2B Event Contract)
// ============================================================================

/**
 * Document Draft Created Event
 * Emitted by Document Copilot to PPAP Workflow (PPAP-Bound mode only)
 */
export interface DocumentDraftCreatedEvent {
  eventType: 'DOCUMENT_DRAFT_CREATED';
  eventId: string;            // UUID for deduplication
  timestamp: string;
  
  payload: {
    ppapId: string;
    documentType: string;     // 'PFMEA' | 'ControlPlan' | etc.
    vaultFileId: string;      // File reference from Vault
    sessionId: string;        // Copilot session ID
    confidence: 'high' | 'medium' | 'low';
    uncertainFields: string[];
  };
  
  actor: {
    userId: string;
    userName: string;
    role: string;
  };
}

// ============================================================================
// Request/Response Types (V3.2B Contracts)
// ============================================================================

/**
 * Launch Copilot Session Request (PPAP Workflow → Document Copilot)
 */
export interface LaunchCopilotSessionRequest {
  ppapId: string;
  documentType: string;       // 'PFMEA' | 'ControlPlan' | etc.
  launchedBy: string;         // User ID
  context: PPAPContext;
}

/**
 * Launch Copilot Session Response
 */
export interface LaunchCopilotSessionResponse {
  sessionId: string;
  status: 'launched' | 'failed';
  error?: string;
}

/**
 * Get EMIP Context Request (Document Copilot → EMIP)
 */
export interface GetEmipContextRequest {
  ppapId: string;
}

/**
 * Get EMIP Context Response
 */
export interface GetEmipContextResponse {
  context: EmipContext;
  metadata: {
    source: 'emip' | 'stub';
    lastUpdated: string;
    confidence: 'high' | 'medium' | 'low';
  };
}
