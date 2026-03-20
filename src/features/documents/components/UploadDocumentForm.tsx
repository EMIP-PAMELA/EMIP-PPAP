'use client';

import { useState } from 'react';
import { supabase } from '@/src/lib/supabaseClient';
import { createDocument } from '@/src/features/documents/mutations';

interface UploadDocumentFormProps {
  ppapId: string;
  onSuccess?: () => void;
}

export function UploadDocumentForm({ ppapId, onSuccess }: UploadDocumentFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    setUploading(true);

    try {
      const filePath = `ppap/${ppapId}/${file.name}`;

      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('ppap-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Failed to upload file to storage:', uploadError);
        alert(`Failed to upload file: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase
        .storage
        .from('ppap-documents')
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      await createDocument({
        ppap_id: ppapId,
        file_name: file.name,
        category: 'GENERAL',
        file_url: fileUrl,
        uploaded_by: 'Matt',
      });

      setFile(null);
      if (e.target instanceof HTMLFormElement) {
        e.target.reset();
      }
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error('Failed to upload document:', err);
      alert('Failed to upload document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="border-t border-gray-200 pt-4 mt-4">
      <div className="space-y-3">
        <div>
          <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-2">
            Upload Document
          </label>
          <input
            id="file"
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-900 border border-gray-300 rounded cursor-pointer bg-gray-50 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {file && (
            <p className="mt-1 text-xs text-gray-500">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </form>
  );
}
