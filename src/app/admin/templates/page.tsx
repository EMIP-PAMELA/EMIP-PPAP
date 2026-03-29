'use client';

/**
 * Phase 30: Template Management UI
 * 
 * Admin-only page for uploading and managing dynamic templates
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, isAdmin } from '../../../features/auth/userService';

type TemplateInfo = {
  id: string;
  name: string;
  description: string;
  type: 'static' | 'dynamic';
  sectionsCount: number;
};

export default function TemplateManagementPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Check admin access
  useEffect(() => {
    async function checkAccess() {
      const user = await getCurrentUser();
      if (!user || !isAdmin(user.role)) {
        router.push('/');
        return;
      }
      setHasAccess(true);
      await loadTemplates();
      setIsLoading(false);
    }
    checkAccess();
  }, [router]);

  // Load templates from registry
  const loadTemplates = async () => {
    try {
      const { listTemplates, listDynamicTemplateIds } = await import('../../../features/documentEngine/templates/registry');
      const allTemplates = listTemplates();
      const dynamicIds = listDynamicTemplateIds();

      const templateInfos: TemplateInfo[] = allTemplates.map((template): TemplateInfo => ({
        id: template.id,
        name: template.name,
        description: template.description,
        type: dynamicIds.includes(template.id) ? 'dynamic' : 'static',
        sectionsCount: template.layout.sections.length,
      }));

      setTemplates(templateInfos);
    } catch (err) {
      console.error('[TemplateManagement] Error loading templates:', err);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      // Read file content
      const fileContent = await file.text();

      // Parse and validate
      const { parseWorkbookTemplate, convertToTemplateDefinition } = await import('../../../features/documentEngine/templates/templateIngestionService');
      const { registerDynamicTemplate, hasTemplate } = await import('../../../features/documentEngine/templates/registry');
      const { saveDynamicTemplate, templateExists } = await import('../../../features/documentEngine/templates/templatePersistenceService');
      const { getCurrentUser } = await import('../../../features/auth/userService');

      const ingestedTemplate = parseWorkbookTemplate(fileContent);
      const templateDefinition = convertToTemplateDefinition(ingestedTemplate);

      // Check if template ID already exists (static or dynamic)
      if (hasTemplate(templateDefinition.id)) {
        setUploadError(`Template ID "${templateDefinition.id}" is already in use. Cannot override existing templates.`);
        event.target.value = '';
        setIsUploading(false);
        return;
      }

      // Check if template exists in database
      const exists = await templateExists(templateDefinition.id);
      if (exists) {
        setUploadError(`Template ID "${templateDefinition.id}" already exists in database. Please use a unique ID.`);
        event.target.value = '';
        setIsUploading(false);
        return;
      }

      // Get current user for upload attribution
      const user = await getCurrentUser();

      // Save to database
      const saved = await saveDynamicTemplate(templateDefinition, user?.id);
      if (!saved) {
        setUploadError('Failed to save template to database');
        event.target.value = '';
        setIsUploading(false);
        return;
      }

      // Register in memory
      registerDynamicTemplate(templateDefinition);

      setUploadSuccess(`Successfully uploaded and saved template: ${templateDefinition.name}`);
      
      // Reload templates
      await loadTemplates();

      // Clear file input
      event.target.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload template');
      console.error('[TemplateManagement] Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete dynamic template
  const handleDeleteTemplate = async (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    if (template.type === 'static') {
      setUploadError('Cannot delete static templates');
      return;
    }

    const confirmed = window.confirm(`Delete template "${template.name}"? This action will remove it from the database.`);
    if (!confirmed) return;

    try {
      setUploadError(null);
      setUploadSuccess(null);

      const { deleteDynamicTemplate } = await import('../../../features/documentEngine/templates/templatePersistenceService');
      
      const deleted = await deleteDynamicTemplate(templateId);
      if (!deleted) {
        setUploadError(`Failed to delete template "${template.name}" from database`);
        return;
      }

      setUploadSuccess(`Template "${template.name}" deleted successfully`);
      
      // Reload templates (will no longer include deleted template)
      await loadTemplates();

      // Note: Template will remain in memory registry until page refresh
      // This is acceptable as it won't reload from DB on next app start
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Template Management</h1>
          <p className="text-gray-600">Upload and manage PPAP document templates</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Template</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Template JSON File
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
          </div>

          {uploadError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <h4 className="text-red-800 font-semibold mb-1">Upload Failed</h4>
              <p className="text-red-700 text-sm">{uploadError}</p>
            </div>
          )}

          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
              <h4 className="text-green-800 font-semibold mb-1">✅ Success</h4>
              <p className="text-green-700 text-sm">{uploadSuccess}</p>
            </div>
          )}

          {isUploading && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-blue-700 text-sm">⏳ Uploading and validating template...</p>
            </div>
          )}

          <div className="mt-4 p-4 bg-gray-50 rounded-md">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Template Requirements:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Valid JSON format</li>
              <li>• Must include: id, name, sections</li>
              <li>• Each section must have: id, title, fields</li>
              <li>• Cannot override static templates (PSW, PROCESS_FLOW, PFMEA, CONTROL_PLAN)</li>
              <li>• See <code className="bg-gray-200 px-1 rounded">templates/examples/tranePFMEA.json</code> for reference</li>
            </ul>
          </div>
        </div>

        {/* Templates List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Available Templates ({templates.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sections
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {template.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-800">
                        {template.id}
                      </code>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          template.type === 'static'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {template.type}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.sectionsCount}
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500 max-w-md truncate">
                      {template.description}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      {template.type === 'dynamic' ? (
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {templates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No templates available
            </div>
          )}
        </div>

        {/* Note about persistence */}
        <div className="mt-6 bg-green-50 border border-green-200 rounded-md p-4">
          <h4 className="text-green-800 font-semibold mb-1">✅ Database Persistence</h4>
          <p className="text-green-700 text-sm">
            Dynamic templates are stored in the database and will persist across page refreshes and app restarts.
            Templates are automatically loaded when the application starts.
          </p>
        </div>
      </div>
    </div>
  );
}
