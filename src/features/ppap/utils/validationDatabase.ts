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
 * Phase 3E.8 - PPAP Requirement Restructure
 * 
 * Trane validation template with clear separation:
 * - Pre-Ack: Readiness validations (boolean checks, not documents)
 * - Post-Ack: Submission documents (REQUIRED/CONDITIONAL)
 */
export const TRANE_VALIDATION_TEMPLATE: ValidationTemplate[] = [
  // Pre-Acknowledgement Readiness (6 validation checks)
  { key: 'drawing_verification', name: 'Drawing Verification', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'bom_review', name: 'BOM Review', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'tooling_validation', name: 'Tooling Validation', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'material_availability', name: 'Material Availability Check', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'psw_presence', name: 'PSW Presence', category: 'pre-ack', required: true, requires_approval: false },
  { key: 'discrepancy_resolution', name: 'Discrepancy Resolution', category: 'pre-ack', required: true, requires_approval: false },
  
  // Post-Acknowledgement REQUIRED Documents (10)
  { key: 'psw', name: 'PSW', category: 'post-ack', required: true, requires_approval: true },
  { key: 'ballooned_drawing', name: 'Ballooned Drawing', category: 'post-ack', required: true, requires_approval: true },
  { key: 'fair', name: 'First Article Inspection Report (FAIR)', category: 'post-ack', required: true, requires_approval: true },
  { key: 'control_plan', name: 'Control Plan', category: 'post-ack', required: true, requires_approval: true },
  { key: 'pfmea', name: 'PFMEA', category: 'post-ack', required: true, requires_approval: true },
  { key: 'dfmea', name: 'DFMEA', category: 'post-ack', required: true, requires_approval: true },
  { key: 'dimensional_results', name: 'Dimensional Results', category: 'post-ack', required: true, requires_approval: true },
  { key: 'material_certs', name: 'Material Certifications', category: 'post-ack', required: true, requires_approval: true },
  { key: 'msa', name: 'MSA', category: 'post-ack', required: true, requires_approval: true },
  { key: 'capability_studies', name: 'Capability Studies', category: 'post-ack', required: true, requires_approval: true },
  
  // Post-Acknowledgement CONDITIONAL Documents (5)
  { key: 'packaging_approval', name: 'Packaging Approval', category: 'post-ack', required: false, requires_approval: true },
  { key: 'appearance_approval', name: 'Appearance Approval', category: 'post-ack', required: false, requires_approval: true },
  { key: 'performance_testing', name: 'Performance Testing', category: 'post-ack', required: false, requires_approval: true },
  { key: 'barcode_standards', name: 'Barcode Standards', category: 'post-ack', required: false, requires_approval: true },
  { key: 'assembly_standards', name: 'Assembly Standards', category: 'post-ack', required: false, requires_approval: true },
];

/**
 * Initialize validations for a new PPAP.
 * Creates 21 validation records based on Trane template:
 * - 6 Pre-Ack Readiness checks
 * - 10 Post-Ack REQUIRED documents
 * - 5 Post-Ack CONDITIONAL documents
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
 * Phase 3H.11: Auto-seed if missing (prevents 0/0 display)
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

  // Phase 3H.11: Auto-seed if no validations exist
  // Phase 3H.12: Enhanced error handling - fail loudly, not silently
  if (!data || data.length === 0) {
    console.warn('⚠️ NO VALIDATIONS FOUND - AUTO-SEEDING DEFAULT SET', { ppapId });
    
    try {
      await initializeValidations(ppapId);
    } catch (seedError) {
      console.error('🚨 VALIDATION SEED FAILED', seedError);
      throw new Error(
        `Validation initialization failed for PPAP ${ppapId}. ` +
        `Error: ${seedError instanceof Error ? seedError.message : 'Unknown error'}. ` +
        `Please contact system administrator.`
      );
    }
    
    // Re-fetch after seeding
    const { data: seededData, error: refetchError } = await supabase
      .from('ppap_validations')
      .select('*')
      .eq('ppap_id', ppapId)
      .order('created_at', { ascending: true });
    
    if (refetchError) {
      console.error('🚨 VALIDATION RE-FETCH FAILED', refetchError);
      throw new Error(`Failed to fetch seeded validations: ${refetchError.message}`);
    }
    
    if (!seededData || seededData.length === 0) {
      console.error('🚨 VALIDATION SEED PRODUCED NO DATA', { ppapId });
      throw new Error('Validation seeding completed but no data returned. Contact system administrator.');
    }
    
    console.log('✅ VALIDATIONS SEEDED', { count: seededData.length });
    return seededData as DBValidation[];
  }

  console.log('🧭 VALIDATION DATA', { ppapId, count: data.length });
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
  // V3.5: Use completed_at presence instead of status string
  return preAckRequired.every(v => v.completed_at != null || v.approved_at != null);
}

/**
 * Check if all post-ack validations are approved.
 */
export function isPostAckReady(validations: DBValidation[]): boolean {
  const postAckRequired = validations.filter(
    v => v.category === 'post-ack' && v.required
  );
  // V3.5: Use approved_at presence instead of status string
  return postAckRequired.every(v => v.approved_at != null);
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
  // V3.5: Use completed_at/approved_at presence instead of status string
  const completed = relevant.filter(
    v => v.completed_at != null || v.approved_at != null
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
