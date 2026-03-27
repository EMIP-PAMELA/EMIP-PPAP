'use client';

import { useState } from 'react';

interface BOMUploadProps {
  onBOMProcessed: (rawText: string) => void;
}

export function BOMUpload({ onBOMProcessed }: BOMUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const text = await file.text();
      
      if (!text.trim()) {
        throw new Error('File is empty');
      }

      onBOMProcessed(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Upload BOM File</h3>
        <p className="text-gray-600 mb-4">
          Upload a Visual Engineering Master BOM file (.txt)
        </p>
        
        <input
          type="file"
          accept=".txt"
          onChange={handleFileUpload}
          disabled={isProcessing}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {isProcessing && (
          <p className="mt-4 text-blue-600">Processing file...</p>
        )}

        {error && (
          <p className="mt-4 text-red-600 text-sm">{error}</p>
        )}
      </div>
    </div>
  );
}
