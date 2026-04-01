/**
 * Claude Orchestrator - Document Copilot Core
 * V3.2F-2 Batch 1
 * 
 * Repurposed from documentGenerator.ts for AI-based generation.
 * Orchestrates document generation through Claude API integration.
 * 
 * Responsibilities:
 * - Retrieve prompt template from registry
 * - Validate required inputs are present
 * - Build message array for Claude API
 * - Call Anthropic API
 * - Handle Claude response and return as CopilotDraft
 * 
 * As defined in V3.2F-1 Section 3 (Claude API Integration Architecture).
 */

import { CopilotInputPackage, CopilotDraft } from '../types/copilotTypes';
import { getPromptTemplate } from '../templates/promptRegistry';

// ============================================================================
// Claude API Configuration
// ============================================================================

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS_INITIAL = 8000;
const TEMPERATURE = 0.3;
const TOP_P = 0.9;

// API key from environment variable (never hardcoded)
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// ============================================================================
// Claude API Request/Response Types
// ============================================================================

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
}

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  top_p: number;
  messages: ClaudeMessage[];
  system?: string;
}

interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ============================================================================
// Orchestration Functions
// ============================================================================

/**
 * Orchestrate document generation through Claude API
 * 
 * @param inputPackage - Complete input package for Claude
 * @returns CopilotDraft with generated document or question/error
 * @throws Error if API key not configured or API call fails
 */
export async function orchestrate(
  inputPackage: CopilotInputPackage
): Promise<CopilotDraft> {
  console.log('[ClaudeOrchestrator] Starting orchestration');
  console.log('[ClaudeOrchestrator] Document type:', inputPackage.template.documentType);
  
  // Validate API key
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }
  
  // Retrieve prompt template from registry
  const promptTemplate = getPromptTemplate(inputPackage.template.documentType);
  console.log('[ClaudeOrchestrator] Prompt template:', promptTemplate.name);
  
  // Validate required inputs
  validateRequiredInputs(inputPackage, promptTemplate);
  
  // Build Claude API request
  const claudeRequest = buildClaudeRequest(inputPackage, promptTemplate);
  
  // Call Claude API
  console.log('[ClaudeOrchestrator] Calling Claude API...');
  const claudeResponse = await callClaudeAPI(claudeRequest);
  
  // Parse and return response
  const copilotDraft = parseClaudeResponse(claudeResponse, inputPackage);
  console.log('[ClaudeOrchestrator] Orchestration complete');
  
  return copilotDraft;
}

/**
 * Validate that all required inputs are present
 * @throws Error if required inputs are missing
 */
function validateRequiredInputs(
  inputPackage: CopilotInputPackage,
  promptTemplate: any
): void {
  const required = promptTemplate.requiredInputs;
  
  if (required.bom && !inputPackage.bomData) {
    throw new Error('BOM data is required for this document type');
  }
  
  if (required.template && !inputPackage.excelTemplate) {
    throw new Error('Excel template is required for this document type');
  }
  
  if (required.drawing && !inputPackage.engineeringDrawing) {
    throw new Error('Engineering drawing is required for this document type');
  }
  
  if (required.ppapContext && !inputPackage.ppapContext) {
    throw new Error('PPAP context is required for this document type');
  }
  
  console.log('[ClaudeOrchestrator] All required inputs validated');
}

/**
 * Build Claude API request from input package
 */
function buildClaudeRequest(
  inputPackage: CopilotInputPackage,
  promptTemplate: any
): ClaudeRequest {
  console.log('[ClaudeOrchestrator] Building Claude API request...');
  
  // Start with system prompt
  const systemPrompt = inputPackage.systemPrompt;
  
  // Build user message content array
  const messageContent: ClaudeMessage['content'] = [];
  
  // Add document instructions
  messageContent.push({
    type: 'text',
    text: `${inputPackage.documentInstructions}\n\n---\n\n`
  });
  
  // Add BOM PDF as base64 document if available
  // Note: For now, we'll send the raw text since we don't have the original PDF binary
  messageContent.push({
    type: 'text',
    text: `BOM Raw Text:\n${inputPackage.bomData.raw}\n\n---\n\n`
  });
  
  // Add parsed BOM data as structured text
  messageContent.push({
    type: 'text',
    text: `Parsed BOM Data (Structured):\n${JSON.stringify(inputPackage.bomData.parsed, null, 2)}\n\n---\n\n`
  });
  
  // Add normalized BOM data
  messageContent.push({
    type: 'text',
    text: `Normalized BOM Data (Business Entities):\n${JSON.stringify(inputPackage.bomData.normalized, null, 2)}\n\n---\n\n`
  });
  
  // Add PPAP context if present
  if (inputPackage.ppapContext) {
    messageContent.push({
      type: 'text',
      text: `PPAP Context:\n${JSON.stringify(inputPackage.ppapContext, null, 2)}\n\n---\n\n`
    });
  }
  
  // Add EMIP context if present
  if (inputPackage.emipContext) {
    messageContent.push({
      type: 'text',
      text: `EMIP Context (${inputPackage.emipContext.metadata.source === 'stub' ? 'STUBBED - Mock Data' : 'Real Data'}):\n${JSON.stringify(inputPackage.emipContext, null, 2)}\n\n---\n\n`
    });
  }
  
  // Add output format specification
  messageContent.push({
    type: 'text',
    text: `Required Output Format:\n${JSON.stringify(inputPackage.template.outputFormat, null, 2)}\n\n---\n\n`
  });
  
  // Add generation instructions
  messageContent.push({
    type: 'text',
    text: `Please generate the document based on the above information. Return structured JSON matching the output format specification.`
  });
  
  // Build complete request
  const request: ClaudeRequest = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS_INITIAL,
    temperature: TEMPERATURE,
    top_p: TOP_P,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: messageContent
      }
    ]
  };
  
  console.log('[ClaudeOrchestrator] Request built:', {
    model: request.model,
    max_tokens: request.max_tokens,
    message_parts: messageContent.length
  });
  
  return request;
}

/**
 * Call Claude API
 * @throws Error if API call fails
 */
async function callClaudeAPI(request: ClaudeRequest): Promise<ClaudeResponse> {
  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(request)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API error (${response.status}): ${errorText}`);
    }
    
    const claudeResponse: ClaudeResponse = await response.json();
    
    console.log('[ClaudeOrchestrator] Claude API response received:', {
      id: claudeResponse.id,
      model: claudeResponse.model,
      stop_reason: claudeResponse.stop_reason,
      input_tokens: claudeResponse.usage.input_tokens,
      output_tokens: claudeResponse.usage.output_tokens,
      total_tokens: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
    });
    
    return claudeResponse;
  } catch (error) {
    console.error('[ClaudeOrchestrator] Claude API call failed:', error);
    throw error;
  }
}

/**
 * Parse Claude response into CopilotDraft
 */
function parseClaudeResponse(
  claudeResponse: ClaudeResponse,
  inputPackage: CopilotInputPackage
): CopilotDraft {
  console.log('[ClaudeOrchestrator] Parsing Claude response...');
  
  // Extract text content from response
  const textContent = claudeResponse.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  
  // Try to parse as JSON
  let parsedContent: any;
  try {
    // Look for JSON in the response (Claude sometimes wraps it in markdown)
    const jsonMatch = textContent.match(/```json\n([\s\S]*?)\n```/) || 
                      textContent.match(/```\n([\s\S]*?)\n```/) ||
                      [null, textContent];
    
    parsedContent = JSON.parse(jsonMatch[1] || textContent);
    console.log('[ClaudeOrchestrator] Successfully parsed JSON response');
  } catch (error) {
    console.error('[ClaudeOrchestrator] Failed to parse Claude response as JSON:', error);
    
    // Return as error if we can't parse
    return {
      type: 'error',
      error: {
        message: 'Failed to parse Claude response as JSON',
        recoverable: true
      },
      metadata: {
        model: claudeResponse.model,
        promptTemplateId: inputPackage.template.documentType,
        tokenCount: {
          input: claudeResponse.usage.input_tokens,
          output: claudeResponse.usage.output_tokens,
          total: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
        },
        generatedAt: new Date().toISOString(),
        confidence: 'low',
        uncertainFields: [],
        assumptions: ['Failed to parse response']
      }
    };
  }
  
  // Check if Claude is asking a question
  if (parsedContent.type === 'question' || parsedContent.question) {
    console.log('[ClaudeOrchestrator] Claude is asking a question');
    return {
      type: 'question',
      question: parsedContent.question || {
        text: parsedContent.text || 'Claude needs more information',
        context: parsedContent.context || '',
        suggestedAnswers: parsedContent.suggestedAnswers
      },
      metadata: {
        model: claudeResponse.model,
        promptTemplateId: inputPackage.template.documentType,
        tokenCount: {
          input: claudeResponse.usage.input_tokens,
          output: claudeResponse.usage.output_tokens,
          total: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
        },
        generatedAt: new Date().toISOString(),
        confidence: 'medium',
        uncertainFields: parsedContent.uncertainFields || [],
        assumptions: []
      }
    };
  }
  
  // Extract confidence metadata if Claude provided it
  const confidence = parsedContent.confidence || 'medium';
  const uncertainFields = parsedContent.uncertainFields || [];
  const assumptions = parsedContent.assumptions || [];
  
  // Build DocumentDraft from parsed content
  const documentDraft = {
    templateId: inputPackage.template.documentType,
    fields: parsedContent,
    metadata: {
      generatedAt: new Date().toISOString(),
      version: 1
    }
  };
  
  // Return as draft
  return {
    type: 'draft',
    documentData: documentDraft,
    metadata: {
      model: claudeResponse.model,
      promptTemplateId: inputPackage.template.documentType,
      tokenCount: {
        input: claudeResponse.usage.input_tokens,
        output: claudeResponse.usage.output_tokens,
        total: claudeResponse.usage.input_tokens + claudeResponse.usage.output_tokens
      },
      generatedAt: new Date().toISOString(),
      confidence: confidence as 'high' | 'medium' | 'low',
      uncertainFields,
      assumptions
    }
  };
}
