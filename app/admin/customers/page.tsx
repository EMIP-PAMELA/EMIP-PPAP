'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, isAdmin } from '@/src/features/auth/userService';
import {
  getCustomers,
  createCustomer,
  deleteCustomer,
  assignTemplateToCustomer,
  removeTemplateFromCustomer,
  getTemplatesForCustomer,
  type Customer
} from '@/src/features/customer/customerService';

export default function CustomersPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [assignedTemplates, setAssignedTemplates] = useState<string[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<Array<{ id: string; name: string; type: 'static' | 'dynamic' }>>([]);
  
  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerDescription, setNewCustomerDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  // Template assignment
  const [showTemplateAssignment, setShowTemplateAssignment] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    async function checkAccess() {
      const user = await getCurrentUser();
      if (!user || !isAdmin(user.role)) {
        router.push('/');
        return;
      }
      setIsLoading(false);
    }
    checkAccess();
  }, [router]);

  // Load customers
  useEffect(() => {
    if (!isLoading) {
      loadCustomers();
      loadAvailableTemplates();
    }
  }, [isLoading]);

  const loadCustomers = async () => {
    const customerList = await getCustomers();
    setCustomers(customerList);
  };

  const loadAvailableTemplates = async () => {
    try {
      const { listTemplates, listDynamicTemplateIds } = await import('@/src/features/documentEngine/templates/registry');
      const allTemplates = listTemplates();
      const dynamicIds = listDynamicTemplateIds();

      const templateList = allTemplates.map((template: any) => ({
        id: template.id,
        name: template.name,
        type: dynamicIds.includes(template.id) ? 'dynamic' as const : 'static' as const,
      }));

      setAvailableTemplates(templateList);
    } catch (err) {
      console.error('[CustomersPage] Error loading templates:', err);
    }
  };

  const handleCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      setErrorMessage('Customer name is required');
      return;
    }

    setIsCreating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await createCustomer(newCustomerName.trim(), newCustomerDescription.trim() || undefined);
      
      if (!created) {
        setErrorMessage('Failed to create customer');
        setIsCreating(false);
        return;
      }

      setSuccessMessage(`Customer "${newCustomerName}" created successfully`);
      setNewCustomerName('');
      setNewCustomerDescription('');
      setShowCreateForm(false);
      await loadCustomers();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    const confirmed = window.confirm(`Delete customer "${customer.name}"? This will remove all template assignments.`);
    if (!confirmed) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const deleted = await deleteCustomer(customer.id);
    if (!deleted) {
      setErrorMessage(`Failed to delete customer "${customer.name}"`);
      return;
    }

    setSuccessMessage(`Customer "${customer.name}" deleted successfully`);
    if (selectedCustomer?.id === customer.id) {
      setSelectedCustomer(null);
      setAssignedTemplates([]);
    }
    await loadCustomers();
  };

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setShowTemplateAssignment(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    // Load assigned templates
    const templates = await getTemplatesForCustomer(customer.id);
    setAssignedTemplates(templates);
  };

  const handleAssignTemplate = async () => {
    if (!selectedCustomer || !selectedTemplateId) return;

    setIsAssigning(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // Check if already assigned
      if (assignedTemplates.includes(selectedTemplateId)) {
        setErrorMessage('Template already assigned to this customer');
        setIsAssigning(false);
        return;
      }

      const assigned = await assignTemplateToCustomer(selectedCustomer.id, selectedTemplateId);
      
      if (!assigned) {
        setErrorMessage('Failed to assign template');
        setIsAssigning(false);
        return;
      }

      setSuccessMessage(`Template assigned to "${selectedCustomer.name}"`);
      setSelectedTemplateId('');
      setShowTemplateAssignment(false);

      // Reload assigned templates
      const templates = await getTemplatesForCustomer(selectedCustomer.id);
      setAssignedTemplates(templates);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to assign template');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveTemplate = async (templateId: string) => {
    if (!selectedCustomer) return;

    const templateName = availableTemplates.find(t => t.id === templateId)?.name || templateId;
    const confirmed = window.confirm(`Remove template "${templateName}" from customer "${selectedCustomer.name}"?`);
    if (!confirmed) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const removed = await removeTemplateFromCustomer(selectedCustomer.id, templateId);
    
    if (!removed) {
      setErrorMessage(`Failed to remove template "${templateName}"`);
      return;
    }

    setSuccessMessage(`Template "${templateName}" removed from "${selectedCustomer.name}"`);

    // Reload assigned templates
    const templates = await getTemplatesForCustomer(selectedCustomer.id);
    setAssignedTemplates(templates);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Customer Management</h1>
        <p className="text-gray-600">Manage customers and their template assignments</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-green-800 font-semibold mb-1">✅ Success</h4>
          <p className="text-green-700 text-sm">{successMessage}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-red-800 font-semibold mb-1">Error</h4>
          <p className="text-red-700 text-sm">{errorMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customers List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Customers</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              {showCreateForm ? 'Cancel' : '+ New Customer'}
            </button>
          </div>

          {/* Create Form */}
          {showCreateForm && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">Create Customer</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                    placeholder="e.g., Acme Corp, Trane, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isCreating}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newCustomerDescription}
                    onChange={(e) => setNewCustomerDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isCreating}
                  />
                </div>
                <button
                  onClick={handleCreateCustomer}
                  disabled={isCreating}
                  className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-300"
                >
                  {isCreating ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </div>
          )}

          {/* Customers List */}
          <div className="space-y-2">
            {customers.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No customers found</p>
            ) : (
              customers.map(customer => (
                <div
                  key={customer.id}
                  className={`p-4 border rounded-md cursor-pointer transition-colors ${
                    selectedCustomer?.id === customer.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{customer.name}</h3>
                      {customer.description && (
                        <p className="text-sm text-gray-600 mt-1">{customer.description}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCustomer(customer);
                      }}
                      className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Template Assignments */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Template Assignments</h2>

          {!selectedCustomer ? (
            <p className="text-center text-gray-500 py-8">Select a customer to manage templates</p>
          ) : (
            <>
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm text-gray-700">
                  <strong>Customer:</strong> {selectedCustomer.name}
                </p>
              </div>

              {/* Assign Template Button */}
              <button
                onClick={() => setShowTemplateAssignment(!showTemplateAssignment)}
                className="mb-4 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
              >
                {showTemplateAssignment ? 'Cancel' : '+ Assign Template'}
              </button>

              {/* Template Assignment Form */}
              {showTemplateAssignment && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
                  <h3 className="text-sm font-semibold text-green-900 mb-3">Assign Template</h3>
                  <div className="space-y-3">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={isAssigning}
                    >
                      <option value="">Select a template...</option>
                      {availableTemplates
                        .filter(t => !assignedTemplates.includes(t.id))
                        .map(template => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.type})
                          </option>
                        ))}
                    </select>
                    <button
                      onClick={handleAssignTemplate}
                      disabled={isAssigning || !selectedTemplateId}
                      className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-300"
                    >
                      {isAssigning ? 'Assigning...' : 'Assign Template'}
                    </button>
                  </div>
                </div>
              )}

              {/* Assigned Templates List */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Assigned Templates ({assignedTemplates.length})
                </h3>
                {assignedTemplates.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">No templates assigned yet</p>
                ) : (
                  <div className="space-y-2">
                    {assignedTemplates.map(templateId => {
                      const template = availableTemplates.find(t => t.id === templateId);
                      return (
                        <div
                          key={templateId}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-md"
                        >
                          <div>
                            <p className="font-medium text-gray-900">
                              {template?.name || templateId}
                            </p>
                            <p className="text-xs text-gray-500">
                              <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                                template?.type === 'static'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {template?.type || 'unknown'}
                              </span>
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveTemplate(templateId)}
                            className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-blue-800 font-semibold mb-1">ℹ️ How It Works</h4>
        <ul className="text-sm text-blue-700 space-y-1 ml-4 list-disc">
          <li>Create customers to represent OEMs or customer organizations</li>
          <li>Assign templates (static or dynamic) to each customer</li>
          <li>When creating a PPAP session, select a customer to auto-load their templates</li>
          <li>Sessions without a customer use the default template set</li>
        </ul>
      </div>
    </div>
  );
}
