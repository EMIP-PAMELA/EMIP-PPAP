'use client';

/**
 * V6.5 EMIP - BOM Upload Component (Bulk Queue Support)
 * 
 * UI COMPONENT - File Upload with Bulk Queue Processing
 * 
 * Responsibilities:
 * - Accept single or multiple PDF file uploads
 * - Drag-and-drop support for bulk files
 * - Sequential queue processing (NOT parallel)
 * - Retry failed uploads with exponential backoff
 * - Show batch progress and per-file status
 * - Failure isolation (continue after errors)
 * 
 * Architecture:
 * - Pure UI component with queue management
 * - Calls bomIngestionService for each file
 * - Sequential processing with throttling
 * - Emits events on success for parent refresh
 */

import React, { useState, useCallback } from 'react';
import { uploadAndIngestBOM } from '@/src/features/bom/services/bomIngestionService';

/**
 * V6.5: Queue item model for bulk upload management
 */
type BOMQueueItem = {
  id: string;
  file: File;
  fileName: string;
  status: 'queued' | 'processing' | 'success' | 'failed' | 'retrying' | 'skipped';
  attempts: number;
  maxAttempts: number;
  error?: string;
  result?: {
    partNumber?: string;
    revision?: string;
    recordsCreated?: number;
  };
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
  
  // V6.5: Create queue from multiple files
  const handleMultipleFiles = (files: File[]) => {
    // Check for duplicates within the batch
    const fileNames = new Set<string>();
    const duplicates: string[] = [];
    
    const newQueueItems: BOMQueueItem[] = [];
    
    files.forEach(file => {
      if (fileNames.has(file.name)) {
        duplicates.push(file.name);
        // Skip duplicate - create skipped item
        newQueueItems.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          fileName: file.name,
          status: 'skipped',
          attempts: 0,
          maxAttempts: 3,
          error: 'Duplicate file in batch'
        });
      } else {
        fileNames.add(file.name);
        newQueueItems.push({
          id: `${Date.now()}-${Math.random()}`,
          file,
          fileName: file.name,
          status: 'queued',
          attempts: 0,
          maxAttempts: 3
        });
      }
    });
    
    if (duplicates.length > 0) {
      console.warn('⚠️ V6.5 DUPLICATE FILES DETECTED', { duplicates });
    }
    
    setQueueItems(newQueueItems);
    setUploadResult(null);
    
    console.log('🧠 V6.5 BULK QUEUE CREATED', {
      totalFiles: files.length,
      uniqueFiles: newQueueItems.filter(i => i.status === 'queued').length,
      duplicates: duplicates.length
    });
    
    // Auto-start processing
    setTimeout(() => processQueue(newQueueItems), 100);
  };
  
  // V6.5: Sequential queue processor with retry logic
  const processQueue = async (items: BOMQueueItem[]) => {
    if (isProcessingBatch) {
      console.warn('⚠️ V6.5 Batch already processing, ignoring new batch');
      return;
    }
    
    setIsProcessingBatch(true);
    setCurrentIndex(0);
    setCompletedCount(0);
    setSuccessCount(0);
    setFailureCount(0);
    
    const queuedItems = items.filter(i => i.status === 'queued' || i.status === 'retrying');
    
    console.log('🧠 V6.5 BULK QUEUE START', {
      totalFiles: queuedItems.length,
      timestamp: new Date().toISOString()
    });
    
    for (let i = 0; i < queuedItems.length; i++) {
      const item = queuedItems[i];
      setCurrentIndex(i);
      
      // Process single item with retry logic
      await processQueueItem(item, i);
      
      // V6.5: Throttle between files (breathing room)
      if (i < queuedItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 750));
      }
    }
    
    setIsProcessingBatch(false);
    setCurrentIndex(-1);
    
    const finalSuccess = queueItems.filter(i => i.status === 'success').length;
    const finalFailure = queueItems.filter(i => i.status === 'failed').length;
    
    console.log('🧠 V6.5 BATCH COMPLETE', {
      totalFiles: queuedItems.length,
      successCount: finalSuccess,
      failureCount: finalFailure
    });
    
    // Notify parent on any success
    if (finalSuccess > 0 && onUploadSuccess) {
      onUploadSuccess();
    }
  };
  
  // V6.5: Process single queue item with retry logic
  const processQueueItem = async (item: BOMQueueItem, index: number) => {
    const maxRetries = item.maxAttempts;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      item.attempts = attempt;
      
      // Update status
      if (attempt === 1) {
        item.status = 'processing';
      } else {
        item.status = 'retrying';
      }
      
      setQueueItems([...queueItems]);
      
      console.log('🧠 V6.5 PROCESSING ITEM', {
        index,
        fileName: item.fileName,
        attempt,
        maxAttempts: maxRetries
      });
      
      try {
        const result = await uploadAndIngestBOM(item.file, bomText, {
          partNumber: partNumber || undefined,
          revision: revision || undefined,
        });
        
        if (result.success) {
          // Success
          item.status = 'success';
          item.result = {
            partNumber: result.partNumber,
            revision: result.revision,
            recordsCreated: result.recordsCreated
          };
          
          setSuccessCount(prev => prev + 1);
          setCompletedCount(prev => prev + 1);
          setQueueItems([...queueItems]);
          
          console.log('🧠 V6.5 ITEM SUCCESS', {
            fileName: item.fileName,
            partNumber: result.partNumber,
            revision: result.revision,
            recordsCreated: result.recordsCreated
          });
          
          return; // Exit retry loop
        } else {
          // Failure from service
          const errorMsg = [...result.errors, ...result.warnings].join('; ');
          throw new Error(errorMsg || 'Upload failed');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        item.error = errorMsg;
        
        console.log('🧠 V6.5 ITEM FAILED', {
          fileName: item.fileName,
          attempt,
          error: errorMsg
        });
        
        if (attempt < maxRetries) {
          // Retry with exponential backoff
          const backoffMs = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`⏳ V6.5 Retrying in ${backoffMs}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        } else {
          // Final failure
          item.status = 'failed';
          setFailureCount(prev => prev + 1);
          setCompletedCount(prev => prev + 1);
          setQueueItems([...queueItems]);
        }
      }
    }
  };
  
  // V6.5: Retry only failed items
  const retryFailed = () => {
    const failedItems = queueItems.filter(i => i.status === 'failed');
    
    if (failedItems.length === 0) return;
    
    // Reset failed items
    failedItems.forEach(item => {
      item.status = 'queued';
      item.attempts = 0;
      item.error = undefined;
    });
    
    setQueueItems([...queueItems]);
    
    console.log('🧠 V6.5 RETRY FAILED', { count: failedItems.length });
    
    processQueue(failedItems);
  };
  
  // V6.5: Clear completed items
  const clearCompleted = () => {
    setQueueItems(queueItems.filter(i => i.status !== 'success'));
  };
  
  // V6.5: Clear all items
  const clearAll = () => {
    setQueueItems([]);
    setUploadResult(null);
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
      
      {/* V6.5: Batch Queue Status UI */}
      {queueItems.length > 0 && (
        <div className="mt-6 border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Batch Upload Queue</h3>
            <div className="flex items-center gap-2">
              {queueItems.filter(i => i.status === 'failed').length > 0 && !isProcessingBatch && (
                <button
                  onClick={retryFailed}
                  className="px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                >
                  Retry Failed ({queueItems.filter(i => i.status === 'failed').length})
                </button>
              )}
              {queueItems.filter(i => i.status === 'success').length > 0 && !isProcessingBatch && (
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
              <div className="text-sm text-green-600">Success</div>
              <div className="text-xl font-bold text-green-900">{queueItems.filter(i => i.status === 'success').length}</div>
            </div>
            <div className="bg-red-50 rounded p-3 text-center">
              <div className="text-sm text-red-600">Failed</div>
              <div className="text-xl font-bold text-red-900">{queueItems.filter(i => i.status === 'failed').length}</div>
            </div>
          </div>
          
          {/* Current File Progress */}
          {isProcessingBatch && currentIndex >= 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="text-sm font-medium text-blue-900">
                Processing {currentIndex + 1} of {queueItems.filter(i => i.status !== 'skipped').length}
              </div>
              <div className="text-xs text-blue-700 mt-1">
                {queueItems[currentIndex]?.fileName}
              </div>
            </div>
          )}
          
          {/* Queue Items List */}
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {queueItems.map((item, index) => (
              <div
                key={item.id}
                className={`p-3 rounded border ${
                  item.status === 'success' ? 'bg-green-50 border-green-200' :
                  item.status === 'failed' ? 'bg-red-50 border-red-200' :
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
                        item.status === 'success' ? 'bg-green-100 text-green-700' :
                        item.status === 'failed' ? 'bg-red-100 text-red-700' :
                        item.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                        item.status === 'retrying' ? 'bg-yellow-100 text-yellow-700' :
                        item.status === 'skipped' ? 'bg-gray-100 text-gray-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {item.status === 'retrying' ? `Retry ${item.attempts}/${item.maxAttempts}` : item.status}
                      </span>
                    </div>
                    
                    {item.status === 'success' && item.result && (
                      <div className="text-xs text-green-700 mt-1">
                        ✅ Part: {item.result.partNumber}, Rev: {item.result.revision}, Records: {item.result.recordsCreated}
                      </div>
                    )}
                    
                    {item.status === 'failed' && item.error && (
                      <div className="text-xs text-red-700 mt-1">
                        ❌ {item.error}
                      </div>
                    )}
                    
                    {item.status === 'skipped' && item.error && (
                      <div className="text-xs text-gray-600 mt-1">
                        ⏭️ {item.error}
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
