'use client';

/**
 * V5.5 EMIP - BOM Upload Component
 * 
 * UI COMPONENT - File Upload with Drag-and-Drop
 * 
 * Responsibilities:
 * - Accept PDF file uploads
 * - Drag-and-drop support
 * - Allow manual BOM text input
 * - Trigger ingestion pipeline
 * - Show upload progress and results
 * 
 * Architecture:
 * - Pure UI component
 * - Calls bomIngestionService
 * - Emits events on success for parent refresh
 */

import React, { useState, useCallback } from 'react';
import { uploadAndIngestBOM } from '@/src/features/bom/services/bomIngestionService';

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
    const pdfFile = files.find(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));

    if (pdfFile) {
      handleFileUpload(pdfFile);
    } else {
      setUploadResult({
        success: false,
        message: 'Please upload a PDF file',
      });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, []);

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
          message: `BOM uploaded successfully!`,
          details: `Part: ${result.partNumber}, Revision: ${result.revision}, Records: ${result.recordsCreated}`
        });

        // Clear form
        setBomText('');
        setPartNumber('');
        setRevision('');

        // Notify parent
        if (onUploadSuccess) {
          onUploadSuccess();
        }
      } else {
        setUploadResult({
          success: false,
          message: 'Upload failed',
          details: result.errors.join('; ')
        });
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
          onChange={handleFileSelect}
          className="hidden"
          id="bom-file-input"
          disabled={isUploading}
        />
        
        <label
          htmlFor="bom-file-input"
          className="cursor-pointer"
        >
          <div className="text-4xl mb-4">📄</div>
          <p className="text-lg font-medium text-gray-900 mb-2">
            Drop BOM PDF here or click to upload
          </p>
          <p className="text-sm text-gray-500">
            PDF files only
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
            disabled={isUploading}
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
            disabled={isUploading}
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
          disabled={isUploading}
        />
      </div>

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
            {uploadResult.success ? '✅' : '❌'} {uploadResult.message}
          </div>
          {uploadResult.details && (
            <div className={`text-sm mt-1 ${uploadResult.success ? 'text-green-700' : 'text-red-700'}`}>
              {uploadResult.details}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
