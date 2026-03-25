import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';

/**
 * Phase 3H - Persistent Validation Engine
 * 
 * Database utilities for validation tracking with persistence.
 */

export type ValidationStatus = 'not_started' | 'in_progress' | 'complete' | 'approved';
export type ValidationCategory = 'pre-ack' | 'post-ack';

export interface DBValidation {
  id: string;
  ppap_id: string;
  validation_key: string;
  name: string;
  category: ValidationCategory;
  required: boolean;
  requires_approval: boolean;
  status: ValidationStatus;
  completed_by: string | null;
  completed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ValidationTemplate {
  key: string;
  name: string;
  category: ValidationCategory;
  required: boolean;
  requires_approval: boolean;
}

/**
 * Trane validation template (14 validations)
 */
export const TRANE_VALIDATION_TEMPLATE: ValidationTemplate[] = [
  // Pre-Ack Validations (5)
  { key: 'design_record', name: 'Design Record', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'dimensional_results', name: 'Dimensional Results', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'material_certs', name: 'Material Certifications', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'performance_test', name: 'Performance Test Results', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'appearance_approval', name: 'Appearance Approval Report', category: 'pre-ack', required: true, requires_approval: false },
  
  // Post-Ack Validations (9)
  { key: 'sample_production', name: 'Sample Production Run', category: 'post-ack', required: true, requires_approval: true },
  { key: 'msa', name: 'Measurement System Analysis', category: 'post-ack', required: true, requires_approval: true },
  { key: 'process_capability', name: 'Process Capability Study', category: 'post-ack', required: true, requires_approval: true },
  { key: 'control_plan', name: 'Control Plan', category: 'post-ack', required: true, requires_approval: true },
  { key: 'pfmea', name: 'Process FMEA', category: 'post-ack', required: true, requires_approval: true },
  { key: 'packaging_approval', name: 'Packaging Approval', category: 'post-ack', required: true, requires_approval: true },
  { key: 'quality_agreement', name: 'Quality Agreement', category: 'post-ack', required: true, requires_approval: true },
  { key: 'shipping_approval', name: 'Shipping Approval', category: 'post-ack', required: true, requires_approval: true },
  { key: 'final_inspection', name: 'Final Inspection Report', category: 'post-ack', required: true, requires_approval: true },
];

/**
 * Initialize validations for a new PPAP.
 * Creates 14 validation records based on Trane template.
 */
export async function initializeValidations(ppapId: string): Promise<void> {
  const validations = TRANE_VALIDATION_TEMPLATE.map(template => ({
    ppap_id: ppapId,
    validation_key: template.key,
    name: template.name,
    category: template.category,
    required: template.required,
    requires_approval: template.requires_approval,
    status: 'not_started' as ValidationStatus,
  }));

  const { error } = await supabase
    .from('ppap_validations')
    .insert(validations);

  if (error) {
    throw new Error(`Failed to initialize validations: ${error.message}`);
  }
}

/**
 * Fetch all validations for a PPAP.
 */
export async function getValidations(ppapId: string): Promise<DBValidation[]> {
  const { data, error } = await supabase
    .from('ppap_validations')
    .select('*')
    .eq('ppap_id', ppapId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch validations: ${error.message}`);
  }

  return data as DBValidation[];
}

/**
 * Update validation status with completion/approval tracking.
 */
export async function updateValidationStatus(
  validationId: string,
  newStatus: ValidationStatus,
  userId: string,
  userRole: string
): Promise<DBValidation> {
  // Fetch current validation
  const { data: current, error: fetchError } = await supabase
    .from('ppap_validations')
    .select('*')
    .eq('id', validationId)
    .single();

  if (fetchError || !current) {
    throw new Error(`Failed to fetch validation: ${fetchError?.message || 'Not found'}`);
  }

  const validation = current as DBValidation;

  // Prepare update data
  const updateData: Partial<DBValidation> = {
    status: newStatus,
  };

  // Set completion tracking
  if (newStatus === 'complete' && !validation.completed_at) {
    updateData.completed_by = userId;
    updateData.completed_at = new Date().toISOString();
  }

  // Set approval tracking
  if (newStatus === 'approved' && !validation.approved_at) {
    updateData.approved_by = userId;
    updateData.approved_at = new Date().toISOString();
  }

  // Update database
  const { data: updated, error: updateError } = await supabase
    .from('ppap_validations')
    .update(updateData)
    .eq('id', validationId)
    .select()
    .single();

  if (updateError || !updated) {
    throw new Error(`Failed to update validation: ${updateError?.message || 'Update failed'}`);
  }

  // Log event
  const eventType = newStatus === 'approved' ? 'VALIDATION_APPROVED' : 'VALIDATION_COMPLETED';
  await logEvent({
    ppap_id: validation.ppap_id,
    event_type: eventType as any, // Will need to add these to EventType enum
    event_data: {
      validation_key: validation.validation_key,
      validation_name: validation.name,
      status: newStatus,
      actor: userId,
      role: userRole,
    },
    actor: userId,
    actor_role: userRole,
  });

  return updated as DBValidation;
}

/**
 * Check if all pre-ack validations are complete.
 */
export function isPreAckReady(validations: DBValidation[]): boolean {
  const preAckRequired = validations.filter(
    v => v.category === 'pre-ack' && v.required
  );
  return preAckRequired.every(v => v.status === 'complete' || v.status === 'approved');
}

/**
 * Check if all post-ack validations are approved.
 */
export function isPostAckReady(validations: DBValidation[]): boolean {
  const postAckRequired = validations.filter(
    v => v.category === 'post-ack' && v.required
  );
  return postAckRequired.every(v => v.status === 'approved');
}

/**
 * Get validation summary string (e.g., "3/5").
 */
export function getValidationSummary(
  validations: DBValidation[],
  category: ValidationCategory
): string {
  const relevant = validations.filter(
    v => v.category === category && v.required
  );
  const completed = relevant.filter(
    v => v.status === 'complete' || v.status === 'approved'
  );

  return `${completed.length}/${relevant.length}`;
}

/**
 * Determine if user can update validation based on role and approval requirements.
 */
export function canUpdateValidation(
  validation: DBValidation,
  userRole: string,
  newStatus: ValidationStatus
): { allowed: boolean; reason?: string } {
  // Engineers can mark as complete
  if (newStatus === 'complete') {
    if (userRole === 'Engineer' || userRole === 'Admin') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Engineers can mark validations as complete' };
  }

  // Coordinators/Admins can approve
  if (newStatus === 'approved') {
    if (!validation.requires_approval) {
      return { allowed: false, reason: 'This validation does not require approval' };
    }
    if (validation.status !== 'complete') {
      return { allowed: false, reason: 'Validation must be complete before approval' };
    }
    if (userRole === 'Coordinator' || userRole === 'Admin') {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Only Coordinators can approve validations' };
  }

  return { allowed: true };
}
