/**
 * Phase 30.1: Dynamic Template Persistence
 * 
 * Service for persisting and loading dynamic templates from database
 */

import { supabase } from '@/src/lib/supabaseClient';
import { TemplateDefinition } from './types';
import { parseWorkbookTemplate, convertToTemplateDefinition } from './templateIngestionService';
import { registerDynamicTemplate, clearDynamicTemplates } from './registry';

export type PersistedTemplate = {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  template_json: any;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
};

/**
 * Get all active dynamic templates from database
 */
export async function getDynamicTemplates(): Promise<PersistedTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('ppap_dynamic_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[TemplatePersistence] Error fetching templates:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[TemplatePersistence] Unexpected error fetching templates:', err);
    return [];
  }
}

/**
 * Save a dynamic template to database
 * Returns the saved template record or null on error
 */
export async function saveDynamicTemplate(
  templateDefinition: TemplateDefinition,
  uploadedBy?: string | null
): Promise<PersistedTemplate | null> {
  try {
    // Serialize the template as JSON (store the ingested format for re-parsing)
    const templateJson = {
      id: templateDefinition.id,
      name: templateDefinition.name,
      description: templateDefinition.description,
      sections: templateDefinition.layout.sections.map(section => ({
        id: section.id,
        title: section.title,
        fields: section.fields.map(fieldKey => {
          const field = templateDefinition.fieldDefinitions.find(f => f.key === fieldKey);
          if (!field) return null;
          
          return {
            key: field.key,
            label: field.label,
            type: field.type,
            required: field.required,
            editable: field.editable,
            options: field.options,
            validation: field.validation,
            columns: field.rowFields?.map((rowField) => ({
              key: rowField.key,
              label: rowField.label,
              type: rowField.type,
              required: rowField.required,
              editable: rowField.editable,
              options: rowField.options,
              validation: rowField.validation,
            })),
          };
        }).filter(Boolean),
      })),
    };

    const { data, error } = await supabase
      .from('ppap_dynamic_templates')
      .insert({
        template_id: templateDefinition.id,
        name: templateDefinition.name,
        description: templateDefinition.description,
        template_json: templateJson,
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[TemplatePersistence] Error saving template:', error);
      return null;
    }

    console.log(`[TemplatePersistence] Saved template: ${templateDefinition.id}`);
    return data;
  } catch (err) {
    console.error('[TemplatePersistence] Unexpected error saving template:', err);
    return null;
  }
}

/**
 * Delete a dynamic template from database (soft delete)
 */
export async function deleteDynamicTemplate(templateId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ppap_dynamic_templates')
      .update({ is_active: false })
      .eq('template_id', templateId);

    if (error) {
      console.error('[TemplatePersistence] Error deleting template:', error);
      return false;
    }

    console.log(`[TemplatePersistence] Deleted template: ${templateId}`);
    return true;
  } catch (err) {
    console.error('[TemplatePersistence] Unexpected error deleting template:', err);
    return false;
  }
}

/**
 * Hard delete a template (for admin cleanup)
 */
export async function hardDeleteDynamicTemplate(templateId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ppap_dynamic_templates')
      .delete()
      .eq('template_id', templateId);

    if (error) {
      console.error('[TemplatePersistence] Error hard deleting template:', error);
      return false;
    }

    console.log(`[TemplatePersistence] Hard deleted template: ${templateId}`);
    return true;
  } catch (err) {
    console.error('[TemplatePersistence] Unexpected error hard deleting template:', err);
    return false;
  }
}

/**
 * Load all persisted dynamic templates and register them in the registry
 * This should be called at app startup
 */
export async function loadAndRegisterDynamicTemplates(): Promise<void> {
  try {
    console.log('[TemplatePersistence] Loading persisted dynamic templates...');
    
    const persistedTemplates = await getDynamicTemplates();
    
    if (persistedTemplates.length === 0) {
      console.log('[TemplatePersistence] No persisted dynamic templates found');
      return;
    }

    console.log(`[TemplatePersistence] Found ${persistedTemplates.length} persisted template(s)`);

    let successCount = 0;
    let failCount = 0;

    for (const persisted of persistedTemplates) {
      try {
        // Parse and validate the stored JSON
        const ingestedTemplate = parseWorkbookTemplate(persisted.template_json);
        const templateDefinition = convertToTemplateDefinition(ingestedTemplate);

        // Register in dynamic registry
        registerDynamicTemplate(templateDefinition);
        
        successCount++;
        console.log(`[TemplatePersistence] ✓ Loaded template: ${templateDefinition.id}`);
      } catch (err) {
        failCount++;
        console.error(`[TemplatePersistence] ✗ Failed to load template ${persisted.template_id}:`, err);
        // Continue loading other templates - don't let one bad template break the app
      }
    }

    console.log(`[TemplatePersistence] Template loading complete: ${successCount} success, ${failCount} failed`);
  } catch (err) {
    console.error('[TemplatePersistence] Unexpected error during template loading:', err);
    // Don't throw - allow app to continue with static templates
  }
}

/**
 * Check if a template ID already exists in database
 */
export async function templateExists(templateId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ppap_dynamic_templates')
      .select('id')
      .eq('template_id', templateId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[TemplatePersistence] Error checking template existence:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[TemplatePersistence] Unexpected error checking template existence:', err);
    return false;
  }
}
