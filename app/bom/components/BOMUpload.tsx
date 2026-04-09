'use client';

/**
 * V6.6 EMIP - BOM Upload Component (Ingestion History + Smart Duplicates + Intelligent Retry)
 * 
 * UI COMPONENT - File Upload with Advanced Queue Management
 * 
 * Responsibilities:
 * - Accept single or multiple PDF file uploads
 * - Drag-and-drop support for bulk files
 * - Sequential queue processing (NOT parallel)
 * - Intelligent retry with error classification
 * - Smart duplicate detection (partNumber+revision)
 * - Ingestion history audit trail
 * - Pause/resume controls
 * - Show batch progress and per-file status
 * - Failure isolation (continue after errors)
 * 
 * Architecture:
 * - Pure UI component with queue management
 * - Calls bomIngestionService for each file
 * - Sequential processing with throttling
 * - Supabase integration for history tracking
 * - Emits events on success for parent refresh
 */

import React, { useState, useCallback, useEffect } from 'react';
import { uploadAndIngestBOM } from '@/src/features/bom/services/bomIngestionService';
import { supabase } from '@/src/lib/supabaseClient';

/**
 * V6.6: Intelligent retry error classification
 * Determines if an error is transient (retryable) or permanent
 */
function isRetryableError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return (
    lowerError.includes('timeout') ||
    lowerError.includes('network') ||
    lowerError.includes('fetch') ||
    lowerError.includes('temporary') ||
    lowerError.includes('ECONNRESET') ||
    lowerError.includes('ETIMEDOUT') ||
    lowerError.includes('503') ||
    lowerError.includes('502') ||
    lowerError.includes('504')
  );
}

/**
 * V6.8: Queue item model for bulk upload management (enhanced with granular status)
 */
type BOMQueueItem = {
  id: string;
  file: File;
  fileName: string;
  status: 'queued' | 'processing' | 'parsing' | 'inserting' | 'complete' | 'failed' | 'retrying' | 'skipped';
  step?: string; // V6.8: Current operation step for live progress
  attempts: number;
  maxAttempts: number;
  error?: string;
  errorType?: 'transient' | 'permanent';
  result?: {
    partNumber?: string;
    revision?: string;
    recordsCreated?: number;
  };
};

/**
 * V6.6: Ingestion run metadata
 */
type IngestionRun = {
  id: string;
  started_at: string;
  completed_at?: string;
  total_files: number;
  success_count: number;
  failure_count: number;
  skipped_count: number;
};

interface BOMUploadProps {
  onUploadSuccess?: () => void;
}

export default function BOMUpload({ onUploadSuccess }: BOMUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    details?: string;
  } | null>(null);
  const [bomText, setBomText] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [revision, setRevision] = useState('');
  
  // V6.5: Batch queue state
  const [queueItems, setQueueItems] = useState<BOMQueueItem[]>([]);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [completedCount, setCompletedCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failureCount, setFailureCount] = useState(0);
  
  // V6.6: Ingestion history state
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [lastRun, setLastRun] = useState<IngestionRun | null>(null);
  
  // V6.9: Item-level control state
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  
  // V6.6: Load last ingestion run on mount
  useEffect(() => {
    loadLastRun();
  }, []);
  
  const loadLastRun = async () => {
    try {
      const { data } = await supabase
        .from('ingestion_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();
      
      if (data) {
        setLastRun(data);
      }
    } catch (error) {
      // No previous runs or error - ignore
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));

    if (pdfFiles.length > 0) {
      // V6.5: Handle multiple files
      handleMultipleFiles(pdfFiles);
    } else {
      setUploadResult({
        success: false,
        message: 'Please upload PDF files',
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // V6.5: Handle multiple files
      handleMultipleFiles(Array.from(files));
    }
  }, []);
  
  // V6.6: Create queue from multiple files (filename warning only)
  const handleMultipleFiles = (files: File[]) => {
    // V6.6: Filename check is now secondary warning only
    const fileNames = new Set<string>();
    const filenameDuplicates: string[] = [];
    
    const newQueueItems: BOMQueueItem[] = [];
    
    files.forEach(file => {
      if (fileNames.has(file.name)) {
        filenameDuplicates.push(file.name);
      }
      fileNames.add(file.name);
      
      // V6.6: Always queue - smart duplicate detection happens during processing
      newQueueItems.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        fileName: file.name,
        status: 'queued',
        attempts: 0,
        maxAttempts: 3
      });
    });
    
    if (filenameDuplicates.length > 0) {
      console.warn('⚠️ V6.6 DUPLICATE FILENAMES (will check partNumber+revision)', { filenameDuplicates });
    }
    
    setQueueItems(newQueueItems);
    setUploadResult(null);
    setIsPaused(false);
    
    console.log('🧠 V6.6 BULK QUEUE CREATED', {
      totalFiles: files.length,
      filenameDuplicates: filenameDuplicates.length
    });
    
    // Auto-start processing
    setTimeout(() => processQueue(newQueueItems), 100);
  };
  
  // V6.6: Sequential queue processor with history tracking
  const processQueue = async (items: BOMQueueItem[]) => {
    if (isProcessingBatch) {
      console.warn('⚠️ V6.6 Batch already processing, ignoring new batch');
      return;
    }
    
    setIsProcessingBatch(true);
    setCurrentIndex(0);
    setCompletedCount(0);
    setSuccessCount(0);
    setFailureCount(0);
    setIsPaused(false);
    
    const queuedItems = items.filter(i => i.status === 'queued' || i.status === 'retrying');
    
    // V6.6: Create ingestion run
    let runId: string | null = null;
    try {
      const { data: run, error } = await supabase
        .from('ingestion_runs')
        .insert({
          total_files: queuedItems.length,
          success_count: 0,
          failure_count: 0,
          skipped_count: 0
        })
        .select()
        .single();
      
      if (error) throw error;
      runId = run.id;
      setCurrentRunId(runId);
      
      console.log('🧠 V6.6 INGESTION RUN START', {
        runId,
        totalFiles: queuedItems.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ V6.6 Failed to create ingestion run', error);
      // Continue without history tracking
    }
    
    for (let i = 0; i < queuedItems.length; i++) {
      // V6.6: Check pause state
      if (isPaused) {
        console.log('⏸️ V6.6 BATCH PAUSED', { atIndex: i });
        setIsProcessingBatch(false);
        return;
      }
      
      const item = queuedItems[i];
      setCurrentIndex(i);
      
      // Process single item with retry logic
      await processQueueItem(item, i, runId);
      
      // V6.6: Throttle between files (breathing room)
      if (i < queuedItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 750));
      }
    }
    
    setIsProcessingBatch(false);
    setCurrentIndex(-1);
    
    const finalSuccess = queueItems.filter(i => i.status === 'complete').length;
    const finalFailure = queueItems.filter(i => i.status === 'failed').length;
    const finalSkipped = queueItems.filter(i => i.status === 'skipped').length;
    
    // V6.6: Finalize ingestion run
    if (runId) {
      try {
        await supabase
          .from('ingestion_runs')
          .update({
            completed_at: new Date().toISOString(),
            success_count: finalSuccess,
            failure_count: finalFailure,
            skipped_count: finalSkipped
          })
          .eq('id', runId);
        
        // Reload last run
        await loadLastRun();
      } catch (error) {
        console.error('❌ V6.6 Failed to finalize run', error);
      }
    }
    
    console.log('🧠 V6.6 BATCH COMPLETE', {
      runId,
      totalFiles: queuedItems.length,
      successCount: finalSuccess,
      failureCount: finalFailure,
      skippedCount: finalSkipped
    });
    
    // Notify parent on any success
    if (finalSuccess > 0 && onUploadSuccess) {
      onUploadSuccess();
    }
  };
  
  // V6.8: Update item helper for real-time status updates
  const updateItem = (index: number, updates: Partial<BOMQueueItem>) => {
    setQueueItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      )
    );
  };
  
  // V6.9: Retry individual item
  const retryItem = (index: number) => {
    const item = queueItems[index];
    console.log('🧠 V6.9 RETRY ITEM', { fileName: item.fileName, index });
    
    updateItem(index, {
      status: 'queued',
      attempts: 0,
      error: undefined,
      errorType: undefined,
      step: undefined
    });
    
    // Auto-resume if paused
    if (isPaused) {
      setIsPaused(false);
      console.log('🧠 V6.9 AUTO-RESUME after retry', { fileName: item.fileName });
    }
    
    // Restart processing if not running
    if (!isProcessingBatch) {
      setTimeout(() => processQueue(queueItems), 100);
    }
  };
  
  // V6.9: Remove individual item from queue
  const removeItem = (index: number) => {
    const item = queueItems[index];
    console.log('🧠 V6.9 REMOVE ITEM', { fileName: item.fileName, index });
    
    setQueueItems(prev => prev.filter((_, i) => i !== index));
    
    // Clean up expanded state
    setExpandedItems(prev => {
      const updated = { ...prev };
      delete updated[item.id];
      return updated;
    });
  };
  
  // V6.9: Toggle expand/collapse for item details
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  
  // V6.6: Process single queue item with smart duplicate detection and intelligent retry
  const processQueueItem = async (item: BOMQueueItem, index: number, runId: string | null) => {
    const maxRetries = item.maxAttempts;
    
    // V6.6: Log to ingestion_items (initial)
    if (runId) {
      try {
        await supabase.from('ingestion_items').insert({
          run_id: runId,
          file_name: item.fileName,
          status: 'queued'
        });
      } catch (error) {
        console.error('❌ V6.6 Failed to log item', error);
      }
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      item.attempts = attempt;
      
      // Update status
      if (attempt === 1) {
        item.status = 'processing';
      } else {
        item.status = 'retrying';
      }
      
      setQueueItems([...queueItems]);
      
      console.log('🧠 V6.6 PROCESSING ITEM', {
        index,
        fileName: item.fileName,
        attempt,
        maxAttempts: maxRetries,
        runId
      });
      
      // V6.9: Validation step
      updateItem(index, {
        status: 'processing',
        step: 'Validating part number and revision'
      });
      
      // Brief validation delay for visibility
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // V6.8: Update status to parsing
      updateItem(index, {
        status: 'parsing',
        step: 'Extracting and parsing PDF'
      });
      
      try {
        const result = await uploadAndIngestBOM(item.file, bomText, {
          partNumber: partNumber || undefined,
          revision: revision || undefined,
        });
        
        // V6.8: Update status to inserting
        if (result.success) {
          updateItem(index, {
            status: 'inserting',
            step: 'Saving to database'
          });
        }
        
        if (result.success) {
          // V6.6: Smart duplicate detection (partNumber + revision)
          const detectedPartNumber = result.partNumber;
          const detectedRevision = result.revision;
          
          if (detectedPartNumber && detectedRevision) {
            const { data: existing } = await supabase
              .from('bom_records')
              .select('id')
              .eq('parent_part_number', detectedPartNumber)
              .eq('revision', detectedRevision)
              .limit(1);
            
            if (existing && existing.length > 0) {
              // Duplicate detected
              item.status = 'skipped';
              item.error = `Duplicate: ${detectedPartNumber} Rev ${detectedRevision} already exists`;
              
              setCompletedCount(prev => prev + 1);
              setQueueItems([...queueItems]);
              
              console.log('🧠 V6.6 DUPLICATE DETECTED', {
                fileName: item.fileName,
                partNumber: detectedPartNumber,
                revision: detectedRevision
              });
              
              // V6.6: Log as skipped
              if (runId) {
                await supabase.from('ingestion_items').update({
                  part_number: detectedPartNumber,
                  revision: detectedRevision,
                  status: 'skipped',
                  error: item.error,
                  attempts: attempt
                }).eq('run_id', runId).eq('file_name', item.fileName);
              }
              
              return; // Skip this item
            }
          }
          
          // V6.8: Success (not duplicate) - update via helper
          updateItem(index, {
            status: 'complete',
            step: 'Completed',
            result: {
              partNumber: result.partNumber,
              revision: result.revision,
              recordsCreated: result.recordsCreated
            }
          });
          
          setSuccessCount(prev => prev + 1);
          setCompletedCount(prev => prev + 1);
          
          console.log('🧠 V6.6 ITEM SUCCESS', {
            fileName: item.fileName,
            partNumber: result.partNumber,
            revision: result.revision,
            recordsCreated: result.recordsCreated
          });
          
          // V6.6: Log success
          if (runId) {
            await supabase.from('ingestion_items').update({
              part_number: result.partNumber,
              revision: result.revision,
              status: 'complete',
              attempts: attempt
            }).eq('run_id', runId).eq('file_name', item.fileName);
          }
          
          return; // Exit retry loop
        } else {
          // Failure from service
          const errorMsg = [...result.errors, ...result.warnings].join('; ');
          throw new Error(errorMsg || 'Upload failed');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        item.error = errorMsg;
        
        // V6.6: Classify error type
        const retryable = isRetryableError(errorMsg);
        item.errorType = retryable ? 'transient' : 'permanent';
        
        console.log('🧠 V6.6 ITEM FAILED', {
          fileName: item.fileName,
          attempt,
          error: errorMsg,
          errorType: item.errorType,
          willRetry: retryable && attempt < maxRetries
        });
        
        // V6.6: Intelligent retry - skip retries for permanent errors
        if (!retryable) {
          console.log('⚠️ V6.6 PERMANENT ERROR - Skipping retries');
          item.status = 'failed';
          setFailureCount(prev => prev + 1);
          setCompletedCount(prev => prev + 1);
          setQueueItems([...queueItems]);
          
          // V6.6: Log permanent failure
          if (runId) {
            await supabase.from('ingestion_items').update({
              status: 'failed',
              error: errorMsg,
              error_type: 'permanent',
              attempts: attempt
            }).eq('run_id', runId).eq('file_name', item.fileName);
          }
          
          return; // Don't retry permanent errors
        }
        
        if (attempt < maxRetries) {
          // Retry with exponential backoff (transient errors only)
          const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ V6.6 Retrying transient error in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Final failure after retries
          item.status = 'failed';
          setFailureCount(prev => prev + 1);
          setCompletedCount(prev => prev + 1);
          setQueueItems([...queueItems]);
          
          // V6.6: Log final failure
          if (runId) {
            await supabase.from('ingestion_items').update({
              status: 'failed',
              error: errorMsg,
              error_type: 'transient',
              attempts: attempt
            }).eq('run_id', runId).eq('file_name', item.fileName);
          }
        }
      }
    }
  };
  
  // V6.6: Pause batch processing
  const pauseBatch = () => {
    setIsPaused(true);
    console.log('⏸️ V6.6 PAUSE REQUESTED');
  };
  
  // V6.6: Resume paused batch
  const resumeBatch = () => {
    setIsPaused(false);
    const remainingItems = queueItems.filter(i => i.status === 'queued' || i.status === 'processing');
    if (remainingItems.length > 0) {
      console.log('▶️ V6.6 RESUME REQUESTED', { remainingItems: remainingItems.length });
      processQueue(queueItems);
    }
  };
  
  // V6.6: Retry failed items
  const retryFailed = () => {
    const itemsToRetry = queueItems.filter(i => i.status === 'failed');
    const updatedItems = queueItems.map(item =>
      item.status === 'failed'
        ? { ...item, status: 'queued' as const, attempts: 0, error: undefined, errorType: undefined }
        : item
    );
    setQueueItems(updatedItems);
    
    // Auto-restart processing
    setTimeout(() => processQueue(updatedItems), 100);
  };
  
  // V6.6: Clear completed items
  const clearCompleted = () => {
    console.log('🧠 V6.6 CLEAR COMPLETED');
    setQueueItems(queueItems.filter(i => i.status !== 'complete'));
  };
  
  // V6.6: Clear all items
  const clearAll = () => {
    console.log('🧠 V6.6 CLEAR ALL');
    setQueueItems([]);
    setUploadResult(null);
    setCurrentRunId(null);
  };

  const handleFileUpload = async (file: File) => {
    console.log('📥 V5.5 [BOM Upload UI] Starting upload', {
      fileName: file.name,
      fileSize: file.size
    });

    setIsUploading(true);
    setUploadResult(null);

    try {
      const result = await uploadAndIngestBOM(file, bomText, {
        partNumber: partNumber || undefined,
        revision: revision || undefined,
      });

      if (result.success) {
        setUploadResult({
          success: true,
          message: `✅ BOM uploaded successfully!`,
          details: `Part: ${result.partNumber}, Revision: ${result.revision}, Records: ${result.recordsCreated}`
        });

        // Clear form on success
        setBomText('');
        setPartNumber('');
        setRevision('');

        // Notify parent
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        // V5.5.1A: Preserve form state on failure, show detailed errors
        const errorDetails = [
          ...result.errors,
          ...(result.warnings.length > 0 ? ['Warnings: ' + result.warnings.join('; ')] : [])
        ].join('\n\n');
        
        setUploadResult({
          success: false,
          message: '❌ Upload failed - please review errors below',
          details: errorDetails
        });
        
        // Do NOT clear form - let user fix issues and retry
      }
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Upload error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Upload BOM</h2>

      {/* Drag-and-Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'}
          ${isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
      >
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="bom-file-input"
          disabled={isUploading || isProcessingBatch}
        />
        
        <label
          htmlFor="bom-file-input"
          className="cursor-pointer"
        >
          <div className="text-4xl mb-4">📄</div>
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop BOM PDF(s) here or click to upload
          </p>
          <p className="text-sm text-gray-500">
            PDF files only • Multiple files supported
          </p>
        </label>
      </div>

      {/* Optional Metadata */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Part Number (optional)
          </label>
          <input
            type="text"
            value={partNumber}
            onChange={(e) => setPartNumber(e.target.value)}
            placeholder="Auto-detected from filename"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading || isProcessingBatch}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Revision (optional)
          </label>
          <input
            type="text"
            value={revision}
            onChange={(e) => setRevision(e.target.value)}
            placeholder="Auto-detected from filename"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isUploading || isProcessingBatch}
          />
        </div>
      </div>

      {/* BOM Text Input (for when PDF extraction not available) */}
      <div className="mt-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          BOM Text (paste if PDF extraction fails)
        </label>
        <textarea
          value={bomText}
          onChange={(e) => setBomText(e.target.value)}
          placeholder="Paste BOM text here..."
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          disabled={isUploading || isProcessingBatch}
        />
      </div>
      
      {/* V6.6: Ingestion History Panel */}
      {lastRun && !isProcessingBatch && queueItems.length === 0 && (
        <div className="mt-6 border-t pt-6">
          <h3 className="text-lg font-semibold mb-3">Last Ingestion Run</h3>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Started</div>
                <div className="font-medium text-gray-900">
                  {new Date(lastRun.started_at).toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-green-600">✅ Success</div>
                <div className="text-xl font-bold text-green-900">{lastRun.success_count}</div>
              </div>
              <div>
                <div className="text-red-600">❌ Failed</div>
                <div className="text-xl font-bold text-red-900">{lastRun.failure_count}</div>
              </div>
              <div>
                <div className="text-gray-600">⏭️ Skipped</div>
                <div className="text-xl font-bold text-gray-900">{lastRun.skipped_count}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* V6.6: Batch Queue Status UI */}
      {queueItems.length > 0 && (
        <div className="mt-6 border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Batch Upload Queue</h3>
            <div className="flex items-center gap-2">
              {/* V6.6: Pause/Resume controls */}
              {isProcessingBatch && !isPaused && (
                <button
                  onClick={pauseBatch}
                  className="px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 flex items-center gap-1"
                >
                  ⏸️ Pause
                </button>
              )}
              {isPaused && (
                <button
                  onClick={resumeBatch}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 flex items-center gap-1"
                >
                  ▶️ Resume
                </button>
              )}
              
              {queueItems.filter(i => i.status === 'failed').length > 0 && !isProcessingBatch && (
                <button
                  onClick={retryFailed}
                  className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                >
                  Retry Failed ({queueItems.filter(i => i.status === 'failed').length})
                </button>
              )}
              {queueItems.filter(i => i.status === 'complete').length > 0 && !isProcessingBatch && (
                <button
                  onClick={clearCompleted}
                  className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                >
                  Clear Completed
                </button>
              )}
              {!isProcessingBatch && (
                <button
                  onClick={clearAll}
                  className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>
          
          {/* Batch Summary */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            <div className="bg-gray-50 rounded p-3 text-center">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-xl font-bold text-gray-900">{queueItems.length}</div>
            </div>
            <div className="bg-blue-50 rounded p-3 text-center">
              <div className="text-sm text-blue-600">Queued</div>
              <div className="text-xl font-bold text-blue-900">{queueItems.filter(i => i.status === 'queued').length}</div>
            </div>
            <div className="bg-yellow-50 rounded p-3 text-center">
              <div className="text-sm text-yellow-600">Processing</div>
              <div className="text-xl font-bold text-yellow-900">{queueItems.filter(i => i.status === 'processing' || i.status === 'retrying').length}</div>
            </div>
            <div className="bg-green-50 rounded p-3 text-center">
              <div className="text-sm text-green-600">Complete</div>
              <div className="text-xl font-bold text-green-900">{queueItems.filter(i => i.status === 'complete').length}</div>
            </div>
            <div className="bg-red-50 rounded p-3 text-center">
              <div className="text-sm text-red-600">Failed</div>
              <div className="text-xl font-bold text-red-900">{queueItems.filter(i => i.status === 'failed').length}</div>
            </div>
          </div>
          
          {/* Current File Progress */}
          {isProcessingBatch && currentIndex >= 0 && (
            <div className={`mb-4 p-3 border rounded ${
              isPaused ? 'bg-yellow-50 border-yellow-200' : 'bg-blue-50 border-blue-200'
            }`}>
              <div className={`text-sm font-medium ${
                isPaused ? 'text-yellow-900' : 'text-blue-900'
              }`}>
                {isPaused ? '⏸️ PAUSED - ' : ''}Processing {currentIndex + 1} of {queueItems.filter(i => i.status !== 'skipped').length}
              </div>
              <div className={`text-xs mt-1 ${
                isPaused ? 'text-yellow-700' : 'text-blue-700'
              }`}>
                {queueItems[currentIndex]?.fileName}
              </div>
              {currentRunId && (
                <div className="text-xs text-gray-500 mt-1">
                  Run ID: {currentRunId.substring(0, 8)}...
                </div>
              )}
            </div>
          )}
          
          {/* Queue Items List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queueItems.map((item, index) => (
              <div
                key={item.id}
                className={`p-3 rounded border ${
                  item.status === 'complete' ? 'bg-green-50 border-green-200' :
                  item.status === 'failed' ? 'bg-red-50 border-red-200' :
                  item.status === 'parsing' ? 'bg-purple-50 border-purple-200' :
                  item.status === 'inserting' ? 'bg-indigo-50 border-indigo-200' :
                  item.status === 'processing' || item.status === 'retrying' ? 'bg-blue-50 border-blue-200' :
                  item.status === 'skipped' ? 'bg-gray-50 border-gray-200' :
                  'bg-gray-50 border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{item.fileName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        item.status === 'complete' ? 'bg-green-100 text-green-700' :
                        item.status === 'failed' ? 'bg-red-100 text-red-700' :
                        item.status === 'parsing' ? 'bg-purple-100 text-purple-700' :
                        item.status === 'inserting' ? 'bg-indigo-100 text-indigo-700' :
                        item.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        item.status === 'retrying' ? 'bg-yellow-100 text-yellow-700' :
                        item.status === 'skipped' ? 'bg-gray-100 text-gray-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {item.status === 'retrying' ? `Retry ${item.attempts}/${item.maxAttempts}` : item.status}
                      </span>
                    </div>
                    
                    {/* V6.8: Show current step for active processing */}
                    {item.step && (item.status === 'processing' || item.status === 'parsing' || item.status === 'inserting') && (
                      <div className="text-xs text-blue-700 mt-1 flex items-center gap-1">
                        <span className="animate-pulse">🔄</span> {item.step}
                      </div>
                    )}
                    
                    {item.status === 'complete' && item.result && (
                      <div className="text-xs text-green-700 mt-1">
                        ✅ Part: {item.result.partNumber}, Rev: {item.result.revision}, Records: {item.result.recordsCreated}
                      </div>
                    )}
                    
                    {item.status === 'failed' && item.error && (
                      <div className="text-xs text-red-700 mt-1">
                        ❌ {item.error}
                        {item.errorType && (
                          <span className="ml-2 px-1 py-0.5 bg-red-100 rounded text-xs">
                            {item.errorType}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {item.status === 'skipped' && item.error && (
                      <div className="text-xs text-gray-600 mt-1">
                        ⏭️ {item.error}
                      </div>
                    )}
                    
                    {/* V6.9: Per-item control buttons */}
                    <div className="flex items-center gap-3 mt-2">
                      {/* Retry button for failed items */}
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryItem(index)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline font-medium"
                          disabled={isProcessingBatch}
                        >
                          🔄 Retry
                        </button>
                      )}
                      
                      {/* Remove button (not for currently processing item) */}
                      {currentIndex !== index && (
                        <button
                          onClick={() => removeItem(index)}
                          className="text-xs text-red-600 hover:text-red-800 underline font-medium"
                          disabled={isProcessingBatch && currentIndex === index}
                        >
                          🗑️ Remove
                        </button>
                      )}
                      
                      {/* Expand/collapse details */}
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="text-xs text-gray-600 hover:text-gray-800 underline font-medium"
                      >
                        {expandedItems[item.id] ? '▼ Hide Details' : '▶ Show Details'}
                      </button>
                    </div>
                    
                    {/* V6.9: Expanded detail view */}
                    {expandedItems[item.id] && (
                      <div className="mt-3 p-3 bg-gray-100 rounded border border-gray-300">
                        <div className="text-xs space-y-1">
                          <div className="font-semibold text-gray-700 mb-2">📋 Diagnostic Details</div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="font-medium text-gray-600">File:</span>
                              <span className="ml-2 text-gray-900">{item.fileName}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-600">Status:</span>
                              <span className="ml-2 text-gray-900">{item.status}</span>
                            </div>
                            
                            <div>
                              <span className="font-medium text-gray-600">Attempts:</span>
                              <span className="ml-2 text-gray-900">{item.attempts} / {item.maxAttempts}</span>
                            </div>
                            
                            {item.result?.partNumber && (
                              <div>
                                <span className="font-medium text-gray-600">Part Number:</span>
                                <span className="ml-2 text-gray-900">{item.result.partNumber}</span>
                              </div>
                            )}
                            
                            {item.result?.revision && (
                              <div>
                                <span className="font-medium text-gray-600">Revision:</span>
                                <span className="ml-2 text-gray-900">{item.result.revision}</span>
                              </div>
                            )}
                            
                            {item.result?.recordsCreated !== undefined && (
                              <div>
                                <span className="font-medium text-gray-600">Records Created:</span>
                                <span className="ml-2 text-gray-900">{item.result.recordsCreated}</span>
                              </div>
                            )}
                            
                            {item.step && (
                              <div className="col-span-2">
                                <span className="font-medium text-gray-600">Current Step:</span>
                                <span className="ml-2 text-gray-900">{item.step}</span>
                              </div>
                            )}
                            
                            {item.errorType && (
                              <div>
                                <span className="font-medium text-gray-600">Error Type:</span>
                                <span className="ml-2 text-gray-900">{item.errorType}</span>
                              </div>
                            )}
                          </div>
                          
                          {item.error && (
                            <div className="mt-2 pt-2 border-t border-gray-300">
                              <div className="font-medium text-red-600 mb-1">Error Message:</div>
                              <div className="text-red-700 bg-red-50 p-2 rounded font-mono text-xs break-words">
                                {item.error}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Status */}
      {isUploading && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin">⏳</div>
            <div>
              <div className="font-medium text-blue-900">Uploading and processing BOM...</div>
              <div className="text-sm text-blue-700">This may take a few seconds</div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Result */}
      {uploadResult && !isUploading && (
        <div className={`
          mt-4 p-4 rounded-lg border
          ${uploadResult.success 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
          }
        `}>
          <div className={`font-medium ${uploadResult.success ? 'text-green-900' : 'text-red-900'}`}>
            {uploadResult.message}
          </div>
          {uploadResult.details && (
            <div className={`text-sm mt-2 ${uploadResult.success ? 'text-green-700' : 'text-red-700'} whitespace-pre-wrap`}>
              {uploadResult.details}
            </div>
          )}
          {!uploadResult.success && (
            <div className="mt-3 text-xs text-red-600 bg-red-100 rounded p-2">
              <strong>💡 Troubleshooting:</strong>
              <ul className="mt-1 ml-4 list-disc">
                <li>Verify storage bucket exists (run migrations)</li>
                <li>Check part number and revision fields</li>
                <li>Ensure BOM text is provided if PDF extraction unavailable</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
