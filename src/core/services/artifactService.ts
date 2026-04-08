/**
 * V5.3 EMIP Core - Artifact Service
 * 
 * FOUNDATION LAYER - Engineering Master Artifact Storage
 * 
 * Responsibilities:
 * - Upload engineering master PDFs to Supabase Storage
 * - Generate structured storage paths
 * - Link artifacts to BOM ingestion batches
 * - Retrieve artifact URLs for dual-view system
 * 
 * Storage Structure:
 * /engineering-masters/{partNumber}/{revision}/{batchId}.pdf
 * 
 * Architecture:
 * - Uses Supabase Storage for immutable artifact storage
 * - Links artifacts to BOM records via ingestion_batch_id
 * - Enables raw PDF vs structured projection dual view
 */

import { supabase } from '@/src/lib/supabaseClient';

// ============================================================
// TYPES
// ============================================================

export interface ArtifactMetadata {
  partNumber: string;
  revision: string;
  ingestion_batch_id: string;
  sourceReference?: string;
}

export interface ArtifactUploadResult {
  success: boolean;
  url: string | null;
  path: string | null;
  partNumber: string;
  revision: string;
  ingestion_batch_id: string;
  error?: string;
}

// ============================================================
// STORAGE CONFIGURATION
// ============================================================

const STORAGE_BUCKET = 'engineering-masters';

// ============================================================
// ARTIFACT UPLOAD
// ============================================================

/**
 * Upload engineering master PDF to Supabase Storage
 * 
 * Storage path: /engineering-masters/{partNumber}/{revision}/{batchId}.pdf
 * 
 * @param file PDF file to upload
 * @param metadata Artifact metadata (part number, revision, batch ID)
 * @returns Upload result with URL and path
 */
export async function uploadEngineeringMaster(
  file: File,
  metadata: ArtifactMetadata
): Promise<ArtifactUploadResult> {
  console.log('🧠 V5.3 [Artifact Service] Uploading engineering master', {
    partNumber: metadata.partNumber,
    revision: metadata.revision,
    batchId: metadata.ingestion_batch_id,
    fileName: file.name,
    fileSize: file.size
  });

  try {
    // V5.5.1A: Verify bucket exists
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('🚫 V5.5.1A [Artifact Service] Cannot verify storage bucket:', bucketError);
      return {
        success: false,
        url: null,
        path: null,
        partNumber: metadata.partNumber,
        revision: metadata.revision,
        ingestion_batch_id: metadata.ingestion_batch_id,
        error: `Storage system error: ${bucketError.message}. Please contact system administrator.`
      };
    }
    
    const bucketExists = buckets?.some(b => b.id === STORAGE_BUCKET);
    if (!bucketExists) {
      console.error('🚫 V5.5.1A [Artifact Service] Storage bucket missing:', STORAGE_BUCKET);
      return {
        success: false,
        url: null,
        path: null,
        partNumber: metadata.partNumber,
        revision: metadata.revision,
        ingestion_batch_id: metadata.ingestion_batch_id,
        error: `Storage bucket '${STORAGE_BUCKET}' not found. Please run database migrations to initialize storage.`
      };
    }
    
    console.log('📦 V5.5.1A STORAGE CHECK', {
      bucket: STORAGE_BUCKET,
      status: 'verified'
    });

    // Generate storage path
    const storagePath = generateStoragePath(metadata);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: 'application/pdf',
        upsert: false // Prevent accidental overwrites
      });

    if (error) {
      console.error('🧠 [Artifact Service] Upload failed:', error);
      return {
        success: false,
        url: null,
        path: null,
        partNumber: metadata.partNumber,
        revision: metadata.revision,
        ingestion_batch_id: metadata.ingestion_batch_id,
        error: error.message
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    console.log('🧠 V5.3 [Artifact Service] Upload successful', {
      path: storagePath,
      url: urlData.publicUrl
    });

    return {
      success: true,
      url: urlData.publicUrl,
      path: storagePath,
      partNumber: metadata.partNumber,
      revision: metadata.revision,
      ingestion_batch_id: metadata.ingestion_batch_id
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown upload error';
    console.error('🧠 [Artifact Service] Upload exception:', errorMessage);
    
    return {
      success: false,
      url: null,
      path: null,
      partNumber: metadata.partNumber,
      revision: metadata.revision,
      ingestion_batch_id: metadata.ingestion_batch_id,
      error: errorMessage
    };
  }
}

/**
 * Generate storage path for engineering master
 * 
 * Format: {partNumber}/{revision}/{batchId}.pdf
 * 
 * @param metadata Artifact metadata
 * @returns Storage path
 */
function generateStoragePath(metadata: ArtifactMetadata): string {
  const { partNumber, revision, ingestion_batch_id } = metadata;
  
  // Sanitize part number and revision for filesystem safety
  const safePart = sanitizePathComponent(partNumber);
  const safeRevision = sanitizePathComponent(revision);
  
  return `${safePart}/${safeRevision}/${ingestion_batch_id}.pdf`;
}

/**
 * Sanitize path component for filesystem safety
 * 
 * @param component Path component to sanitize
 * @returns Safe path component
 */
function sanitizePathComponent(component: string): string {
  return component
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 100); // Limit length
}

// ============================================================
// ARTIFACT RETRIEVAL
// ============================================================

/**
 * Get artifact URL for a BOM ingestion batch
 * 
 * @param ingestion_batch_id Batch ID
 * @returns Artifact URL or null if not found
 */
export async function getArtifactUrl(ingestion_batch_id: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('bom_records')
    .select('artifact_url')
    .eq('ingestion_batch_id', ingestion_batch_id)
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data.artifact_url;
}

/**
 * Get artifact metadata for a part number
 * 
 * Returns artifact info for the active BOM version.
 * 
 * @param partNumber Part number
 * @returns Artifact metadata or null
 */
export async function getArtifactForPart(partNumber: string): Promise<{
  url: string;
  path: string;
  revision: string;
  ingestion_batch_id: string;
} | null> {
  const { data, error } = await supabase
    .from('bom_records')
    .select('artifact_url, artifact_path, revision, ingestion_batch_id')
    .eq('parent_part_number', partNumber)
    .eq('is_active', true)
    .limit(1)
    .single();

  if (error || !data || !data.artifact_url) {
    return null;
  }

  return {
    url: data.artifact_url,
    path: data.artifact_path,
    revision: data.revision,
    ingestion_batch_id: data.ingestion_batch_id
  };
}

// ============================================================
// ARTIFACT DELETION (FUTURE)
// ============================================================

/**
 * Delete artifact from storage
 * 
 * NOTE: Use with caution - this removes the immutable source of truth
 * 
 * @param path Storage path
 * @returns Success status
 */
export async function deleteArtifact(path: string): Promise<boolean> {
  console.warn('🧠 V5.3 [Artifact Service] Deleting artifact:', path);
  
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.error('🧠 [Artifact Service] Delete failed:', error);
    return false;
  }

  return true;
}
