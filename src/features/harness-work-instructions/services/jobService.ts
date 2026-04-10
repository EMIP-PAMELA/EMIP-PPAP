/**
 * Harness Work Instruction Generator — Job Persistence Service
 * Phase HWI.5 — Approval Workflow + Versioning
 *
 * Responsibilities:
 *  - Version numbering per (part_number, revision)
 *  - Inserting approved job records into harness_instruction_jobs
 *  - Uploading generated PDFs to Supabase Storage (harness-instructions bucket)
 *  - Linking PDF artifacts in harness_instruction_artifacts
 *  - Listing approved job history
 *
 * Storage path: {part_number}/{revision}/v{version}/{filename}.pdf
 */

import { supabase } from '@/src/lib/supabaseClient';
import type { HarnessInstructionJob } from '../types/harnessInstruction.schema';

const HWI_BUCKET = 'harness-instructions';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ApprovalResult {
  jobId: string;
  version: number;
  artifactUrl: string | null;
  approvedAt: string;
}

export interface JobListItem {
  id: string;
  part_number: string;
  revision: string;
  version: number;
  status: string;
  approved_at: string;
  approved_by: string | null;
  artifact_url: string | null;
  file_name: string | null;
}

// ---------------------------------------------------------------------------
// Versioning
// ---------------------------------------------------------------------------

export async function getNextVersion(
  partNumber: string,
  revision: string
): Promise<number> {
  const { data, error } = await supabase
    .from('harness_instruction_jobs')
    .select('version')
    .eq('part_number', partNumber)
    .eq('revision', revision)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`[HWI Job Service] getNextVersion failed: ${error.message}`);
  }
  return (data?.version ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Save approved job + upload PDF
// ---------------------------------------------------------------------------

export async function saveApprovedJob(
  job: HarnessInstructionJob,
  pdfBuffer: Buffer,
  approvedBy: string
): Promise<ApprovalResult> {
  const approvedAt = new Date().toISOString();
  const version    = await getNextVersion(job.metadata.part_number, job.metadata.revision);

  console.log('[HWI APPROVAL START]', {
    partNumber: job.metadata.part_number,
    revision:   job.metadata.revision,
    version,
    approvedBy,
    timestamp:  approvedAt,
  });

  // 1. Insert job record
  const { data: jobData, error: jobError } = await supabase
    .from('harness_instruction_jobs')
    .insert({
      part_number: job.metadata.part_number,
      revision:    job.metadata.revision,
      version,
      status:      'approved',
      data:        job,
      approved_at: approvedAt,
      approved_by: approvedBy || null,
    })
    .select('id')
    .single();

  if (jobError) {
    throw new Error(`[HWI Job Service] DB insert failed: ${jobError.message}`);
  }

  const jobId = jobData.id as string;
  console.log('[HWI JOB SAVED]', { jobId, version, partNumber: job.metadata.part_number });

  // 2. Upload PDF to Supabase Storage
  const rawName  = `WI-${job.metadata.part_number}-Rev${job.metadata.revision}-v${version}.pdf`;
  const fileName = rawName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const storagePath = `${job.metadata.part_number}/${job.metadata.revision}/v${version}/${fileName}`;

  let artifactUrl: string | null = null;

  const { error: uploadError } = await supabase.storage
    .from(HWI_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    console.error('[HWI Job Service] PDF upload failed (non-fatal):', uploadError.message);
  } else {
    const { data: urlData } = supabase.storage
      .from(HWI_BUCKET)
      .getPublicUrl(storagePath);

    artifactUrl = urlData.publicUrl;

    // 3. Insert artifact record
    await supabase
      .from('harness_instruction_artifacts')
      .insert({ job_id: jobId, file_name: fileName, file_url: artifactUrl });

    console.log('[HWI PDF STORED]', { fileName, artifactUrl });
  }

  console.log('[HWI APPROVAL COMPLETE]', { jobId, version, artifactUrl });

  return { jobId, version, artifactUrl, approvedAt };
}

// ---------------------------------------------------------------------------
// List approved jobs
// ---------------------------------------------------------------------------

export async function listApprovedJobs(partNumber?: string): Promise<JobListItem[]> {
  let query = supabase
    .from('harness_instruction_jobs')
    .select(`
      id, part_number, revision, version, status, approved_at, approved_by,
      harness_instruction_artifacts ( file_name, file_url )
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(100);

  if (partNumber) {
    query = query.eq('part_number', partNumber);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`[HWI Job Service] listApprovedJobs failed: ${error.message}`);
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const artifacts = Array.isArray(row.harness_instruction_artifacts)
      ? row.harness_instruction_artifacts as { file_name: string; file_url: string }[]
      : [];
    return {
      id:           row.id as string,
      part_number:  row.part_number as string,
      revision:     row.revision as string,
      version:      row.version as number,
      status:       row.status as string,
      approved_at:  row.approved_at as string,
      approved_by:  row.approved_by as string | null,
      artifact_url: artifacts[0]?.file_url ?? null,
      file_name:    artifacts[0]?.file_name ?? null,
    };
  });
}
