'use client';

import { useState, useEffect, useRef } from 'react';
import { CopilotDraft } from '../types/copilotTypes';
import { 
  getConversationHistory, 
  addUserMessage, 
  addClaudeResponse 
} from '../services/copilotSessionManager';
import { orchestrate } from '../core/claudeOrchestrator';
import { RawBOMData, NormalizedBOM } from '../types/bomTypes';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  messageType: 'text' | 'question' | 'draft' | 'error';
  draft?: CopilotDraft;
}

interface CopilotChatPanelProps {
  sessionId: string;
  documentType: string;
  mode: 'ppap-bound' | 'standalone';
  ppapId?: string;
  uploadedFiles?: {
    bomFile?: File;
    templateFile?: File;
    drawingFile?: File;
  };
  bomText?: string;
  parsedBomData?: RawBOMData;
  normalizedBom?: NormalizedBOM;
  onDraftReady: (draft: CopilotDraft) => void;
  onQuestionAsked: (question: string) => void;
  disabled?: boolean;
}

export function CopilotChatPanel({
  sessionId,
  documentType,
  mode,
  ppapId,
  uploadedFiles,
  bomText,
  parsedBomData,
  normalizedBom,
  onDraftReady,
  onQuestionAsked,
  disabled = false
}: CopilotChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<CopilotDraft | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load existing conversation history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const history = await getConversationHistory(sessionId);
        const formattedMessages: Message[] = history.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          messageType: 'text'
        }));
        setMessages(formattedMessages);
        console.log('[CopilotChatPanel] Loaded conversation history:', formattedMessages.length, 'messages');
      } catch (err) {
        console.error('[CopilotChatPanel] Error loading conversation history:', err);
      }
    }
    loadHistory();
  }, [sessionId]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Helper: Convert File to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || disabled) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setIsLoading(true);

    try {
      // Add user message to UI
      const newUserMessage: Message = {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString(),
        messageType: 'text'
      };
      setMessages(prev => [...prev, newUserMessage]);

      // Save user message to session
      await addUserMessage(sessionId, userMessage);

      // Call Claude orchestrator with real input package
      console.log('[CopilotChatPanel] Calling Claude orchestrator with real BOM data...');
      
      // Convert files to base64 for Claude API
      const bomFileBase64 = uploadedFiles?.bomFile ? await fileToBase64(uploadedFiles.bomFile) : undefined;
      const templateFileBase64 = uploadedFiles?.templateFile ? await fileToBase64(uploadedFiles.templateFile) : undefined;
      const drawingFileBase64 = uploadedFiles?.drawingFile ? await fileToBase64(uploadedFiles.drawingFile) : undefined;
      
      // Build input package with real parsed BOM data
      const inputPackage: any = {
        template: {
          documentType,
          requiredFields: [],
          outputFormat: {},
          validationRules: []
        },
        systemPrompt: `You are an AI assistant helping generate ${documentType} documents.`,
        documentInstructions: 'Generate based on user requirements.',
        bomData: (parsedBomData || bomText) ? {
          raw: bomText || '',
          parsed: parsedBomData,
          normalized: normalizedBom
        } : undefined,
        files: {
          bomPdf: bomFileBase64 ? {
            base64: bomFileBase64,
            mediaType: 'application/pdf',
            filename: uploadedFiles?.bomFile?.name
          } : undefined,
          template: templateFileBase64 ? {
            base64: templateFileBase64,
            mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            filename: uploadedFiles?.templateFile?.name
          } : undefined,
          drawing: drawingFileBase64 ? {
            base64: drawingFileBase64,
            mediaType: uploadedFiles?.drawingFile?.type || 'application/pdf',
            filename: uploadedFiles?.drawingFile?.name
          } : undefined
        },
        ppapContext: mode === 'ppap-bound' && ppapId ? {
          ppapId,
          partNumber: 'PART-XXX',
          customerName: 'Customer',
          revision: 'A',
          supplierName: 'Supplier'
        } : undefined
      };
      
      console.log('[CopilotChatPanel] Input package prepared:', {
        hasBomData: !!inputPackage.bomData,
        componentCount: normalizedBom?.operations.reduce((sum, op) => sum + op.components.length, 0) || 0,
        hasTemplateFile: !!templateFileBase64,
        hasBomFile: !!bomFileBase64
      });
      
      // Call real orchestrator
      const copilotDraft = await orchestrate(inputPackage);
      
      // Handle Claude response based on type
      if (copilotDraft.type === 'question') {
        // Claude asked a question
        const questionMessage: Message = {
          role: 'assistant',
          content: copilotDraft.question?.text || '',
          timestamp: new Date().toISOString(),
          messageType: 'question'
        };
        setMessages(prev => [...prev, questionMessage]);
        await addClaudeResponse(sessionId, copilotDraft);
        onQuestionAsked(copilotDraft.question?.text || '');
        
      } else if (copilotDraft.type === 'draft') {
        // Claude returned a draft
        const draftMessage: Message = {
          role: 'assistant',
          content: 'I\'ve completed the document draft. Please review:',
          timestamp: new Date().toISOString(),
          messageType: 'draft',
          draft: copilotDraft
        };
        setMessages(prev => [...prev, draftMessage]);
        setCurrentDraft(copilotDraft);
        await addClaudeResponse(sessionId, copilotDraft);
        onDraftReady(copilotDraft);
        
      } else if (copilotDraft.type === 'error') {
        // Claude encountered an error
        const errorMessage: Message = {
          role: 'assistant',
          content: copilotDraft.error?.message || 'An error occurred',
          timestamp: new Date().toISOString(),
          messageType: 'error'
        };
        setMessages(prev => [...prev, errorMessage]);
        await addClaudeResponse(sessionId, copilotDraft);
        
      } else {
        // Regular text response
        const textMessage: Message = {
          role: 'assistant',
          content: 'Thank you for that information. I\'m processing your request...',
          timestamp: new Date().toISOString(),
          messageType: 'text'
        };
        setMessages(prev => [...prev, textMessage]);
        await addClaudeResponse(sessionId, copilotDraft);
      }

    } catch (err) {
      console.error('[CopilotChatPanel] Error sending message:', err);
      const errorMessage: Message = {
        role: 'assistant',
        content: err instanceof Error ? err.message : 'Failed to process message',
        timestamp: new Date().toISOString(),
        messageType: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async (messageIndex: number) => {
    // Retry the last user message that caused an error
    const lastUserMessage = messages
      .slice(0, messageIndex)
      .reverse()
      .find(m => m.role === 'user');
    
    if (lastUserMessage) {
      setInputValue(lastUserMessage.content);
      // User can edit and resend
    }
  };

  const handleAcceptDraft = (draft: CopilotDraft) => {
    console.log('[CopilotChatPanel] Draft accepted');
    onDraftReady(draft);
  };

  const handleRequestChanges = async (feedback: string) => {
    console.log('[CopilotChatPanel] Changes requested:', feedback);
    setInputValue(feedback);
    // User can send the feedback back to Claude
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Document Copilot</h3>
        <p className="text-sm text-gray-600 mt-1">AI-guided document generation with Claude</p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">
              👋 Hello! I'm your Document Copilot. I'll help you generate PPAP documents by asking you questions and understanding your requirements.
            </p>
            <p className="text-gray-400 text-xs mt-2">
              {(bomText || uploadedFiles?.bomFile)
                ? 'BOM data received. Send a message to start generating your document.'
                : 'Send a message to describe what you need.'}
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.messageType === 'error'
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : message.messageType === 'question'
                  ? 'bg-yellow-50 border border-yellow-200 text-gray-900'
                  : message.messageType === 'draft'
                  ? 'bg-green-50 border border-green-200 text-gray-900 w-full'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {message.messageType === 'question' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-yellow-600 font-semibold text-sm">❓ Question</span>
                </div>
              )}

              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              
              {message.messageType === 'draft' && (
                <div className="mt-3 text-sm text-green-700">
                  Draft ready for review. Transitioning to review phase...
                </div>
              )}

              {message.messageType === 'error' && (
                <button
                  onClick={() => handleRetry(index)}
                  className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
                >
                  Retry
                </button>
              )}

              <p className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="animate-pulse flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                </div>
                <span className="text-sm text-gray-600">Claude is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="flex gap-3">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={disabled || isLoading}
            placeholder="Type your message or answer to Claude's question..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={disabled || isLoading || !inputValue.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {isLoading ? '...' : 'Send'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Powered by Claude Sonnet 4 • Responses are AI-generated and should be reviewed
        </p>
      </div>
    </div>
  );
}
