/**
 * Phase 31: Customer Profiles and Template Assignment
 * 
 * Service for managing customers and their template assignments
 */

import { supabase } from '@/src/lib/supabaseClient';

export type Customer = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type CustomerTemplate = {
  id: string;
  customer_id: string;
  template_id: string;
  created_at: string;
};

/**
 * Get all customers
 */
export async function getCustomers(): Promise<Customer[]> {
  try {
    const { data, error } = await supabase
      .from('ppap_customers')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('[CustomerService] Error fetching customers:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[CustomerService] Unexpected error fetching customers:', err);
    return [];
  }
}

/**
 * Get a single customer by ID
 */
export async function getCustomerById(customerId: string): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error) {
      console.error('[CustomerService] Error fetching customer:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[CustomerService] Unexpected error fetching customer:', err);
    return null;
  }
}

/**
 * Create a new customer
 */
export async function createCustomer(
  name: string,
  description?: string
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_customers')
      .insert({
        name,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[CustomerService] Error creating customer:', error);
      return null;
    }

    console.log(`[CustomerService] Created customer: ${name}`);
    return data;
  } catch (err) {
    console.error('[CustomerService] Unexpected error creating customer:', err);
    return null;
  }
}

/**
 * Update customer details
 */
export async function updateCustomer(
  customerId: string,
  name: string,
  description?: string
): Promise<Customer | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_customers')
      .update({
        name,
        description: description || null,
      })
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      console.error('[CustomerService] Error updating customer:', error);
      return null;
    }

    console.log(`[CustomerService] Updated customer: ${customerId}`);
    return data;
  } catch (err) {
    console.error('[CustomerService] Unexpected error updating customer:', err);
    return null;
  }
}

/**
 * Delete a customer
 */
export async function deleteCustomer(customerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ppap_customers')
      .delete()
      .eq('id', customerId);

    if (error) {
      console.error('[CustomerService] Error deleting customer:', error);
      return false;
    }

    console.log(`[CustomerService] Deleted customer: ${customerId}`);
    return true;
  } catch (err) {
    console.error('[CustomerService] Unexpected error deleting customer:', err);
    return false;
  }
}

/**
 * Assign a template to a customer
 */
export async function assignTemplateToCustomer(
  customerId: string,
  templateId: string
): Promise<CustomerTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('ppap_customer_templates')
      .insert({
        customer_id: customerId,
        template_id: templateId,
      })
      .select()
      .single();

    if (error) {
      console.error('[CustomerService] Error assigning template:', error);
      return null;
    }

    console.log(`[CustomerService] Assigned template ${templateId} to customer ${customerId}`);
    return data;
  } catch (err) {
    console.error('[CustomerService] Unexpected error assigning template:', err);
    return null;
  }
}

/**
 * Remove a template assignment from a customer
 */
export async function removeTemplateFromCustomer(
  customerId: string,
  templateId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ppap_customer_templates')
      .delete()
      .eq('customer_id', customerId)
      .eq('template_id', templateId);

    if (error) {
      console.error('[CustomerService] Error removing template assignment:', error);
      return false;
    }

    console.log(`[CustomerService] Removed template ${templateId} from customer ${customerId}`);
    return true;
  } catch (err) {
    console.error('[CustomerService] Unexpected error removing template assignment:', err);
    return false;
  }
}

/**
 * Get all templates assigned to a customer
 */
export async function getTemplatesForCustomer(customerId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('ppap_customer_templates')
      .select('template_id')
      .eq('customer_id', customerId);

    if (error) {
      console.error('[CustomerService] Error fetching customer templates:', error);
      return [];
    }

    return data?.map(row => row.template_id) || [];
  } catch (err) {
    console.error('[CustomerService] Unexpected error fetching customer templates:', err);
    return [];
  }
}

/**
 * Get all customer template assignments (for admin UI)
 */
export async function getCustomerTemplateAssignments(customerId: string): Promise<CustomerTemplate[]> {
  try {
    const { data, error } = await supabase
      .from('ppap_customer_templates')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[CustomerService] Error fetching customer template assignments:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[CustomerService] Unexpected error fetching customer template assignments:', err);
    return [];
  }
}

/**
 * Check if a template is assigned to a customer
 */
export async function isTemplateAssignedToCustomer(
  customerId: string,
  templateId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('ppap_customer_templates')
      .select('id')
      .eq('customer_id', customerId)
      .eq('template_id', templateId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[CustomerService] Error checking template assignment:', error);
      return false;
    }

    return !!data;
  } catch (err) {
    console.error('[CustomerService] Unexpected error checking template assignment:', err);
    return false;
  }
}
