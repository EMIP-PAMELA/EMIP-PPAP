'use client';

import { useState } from 'react';
import { logEvent } from '@/src/features/events/mutations';

interface InitiationFormProps {
  ppapId: string;
  partNumber: string;
  onPhaseAdvance: () => void;
}

type Section = 'project_info' | 'contacts' | 'part_info' | 'drawing' | 'shipment' | 'warrant';

interface InitiationData {
  ppap_type: string;
  project_name: string;
  project_number: string;
  quality_rep: string;
  quality_email: string;
  rd_rep: string;
  sourcing_rep: string;
  part_number: string;
  part_description: string;
  drawing_number: string;
  revision: string;
  parts_producible: boolean;
  capability_met: boolean;
  sample_quantity: string;
  ship_to_location: string;
  drawing_understood: boolean;
  part_defined: boolean;
  packaging_met: boolean;
}

export function InitiationForm({ ppapId, partNumber, onPhaseAdvance }: InitiationFormProps) {
  const [activeSection, setActiveSection] = useState<Section>('project_info');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState<InitiationData>({
    ppap_type: '',
    project_name: '',
    project_number: '',
    quality_rep: '',
    quality_email: '',
    rd_rep: '',
    sourcing_rep: '',
    part_number: partNumber,
    part_description: '',
    drawing_number: '',
    revision: '',
    parts_producible: false,
    capability_met: false,
    sample_quantity: '',
    ship_to_location: '',
    drawing_understood: false,
    part_defined: false,
    packaging_met: false,
  });

  const sections: { key: Section; label: string }[] = [
    { key: 'project_info', label: 'Project Info' },
    { key: 'contacts', label: 'Contacts' },
    { key: 'part_info', label: 'Part Info' },
    { key: 'drawing', label: 'Drawing Data' },
    { key: 'shipment', label: 'Shipment' },
    { key: 'warrant', label: 'Warrant' },
  ];

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.ppap_type) newErrors.ppap_type = 'PPAP Type is required';
    if (!formData.project_name) newErrors.project_name = 'Project Name is required';
    if (!formData.quality_rep) newErrors.quality_rep = 'Quality Rep is required';
    if (!formData.quality_email) newErrors.quality_email = 'Quality Email is required';
    if (!formData.part_description) newErrors.part_description = 'Part Description is required';
    if (!formData.drawing_number) newErrors.drawing_number = 'Drawing Number is required';
    if (!formData.revision) newErrors.revision = 'Revision is required';
    if (!formData.sample_quantity) newErrors.sample_quantity = 'Sample Quantity is required';
    if (!formData.ship_to_location) newErrors.ship_to_location = 'Ship To Location is required';

    if (!formData.parts_producible) {
      newErrors.parts_producible = 'Must confirm parts are producible';
    }
    if (!formData.capability_met) {
      newErrors.capability_met = 'Must confirm capability is met';
    }
    if (!formData.drawing_understood) {
      newErrors.drawing_understood = 'Must confirm drawing is understood';
    }
    if (!formData.part_defined) {
      newErrors.part_defined = 'Must confirm part is defined';
    }
    if (!formData.packaging_met) {
      newErrors.packaging_met = 'Must confirm packaging is met';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdvancePhase = async () => {
    setErrors({});
    setSuccessMessage('');

    if (!validateForm()) {
      setErrors(prev => ({
        ...prev,
        _form: 'Please complete all required fields and confirmations',
      }));
      return;
    }

    setLoading(true);

    try {
      await logEvent({
        ppap_id: ppapId,
        event_type: 'PHASE_ADVANCED',
        event_data: {
          from_phase: 'INITIATION',
          to_phase: 'DOCUMENTATION',
          initiation_data: formData,
        },
        actor: 'Matt',
      });

      setSuccessMessage('✓ Initiation phase completed! Advancing to Documentation phase...');
      
      setTimeout(() => {
        onPhaseAdvance();
      }, 1500);
    } catch (error) {
      console.error('Failed to advance phase:', error);
      setErrors({ _form: 'Failed to advance phase. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof InitiationData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">INITIATION Phase</h2>
        {successMessage && (
          <div className="text-sm font-medium text-green-700 bg-green-50 px-4 py-2 rounded">
            {successMessage}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        <div className="w-48 flex-shrink-0">
          <nav className="space-y-1">
            {sections.map(section => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`w-full text-left px-3 py-2 text-sm font-medium rounded transition-colors ${
                  activeSection === section.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex-1">
          {errors._form && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {errors._form}
            </div>
          )}

          {activeSection === 'project_info' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">PPAP Project Info</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PPAP Type <span className="text-red-600">*</span>
                </label>
                <select
                  value={formData.ppap_type}
                  onChange={(e) => updateField('ppap_type', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.ppap_type ? 'border-red-400' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select Type</option>
                  <option value="NPI">NPI</option>
                  <option value="SER">SER</option>
                  <option value="Maintenance">Maintenance</option>
                </select>
                {errors.ppap_type && (
                  <p className="mt-1 text-sm text-red-600">{errors.ppap_type}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.project_name}
                  onChange={(e) => updateField('project_name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.project_name ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="Enter project name"
                />
                {errors.project_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.project_name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Number
                </label>
                <input
                  type="text"
                  value={formData.project_number}
                  onChange={(e) => updateField('project_number', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project number (optional)"
                />
              </div>
            </div>
          )}

          {activeSection === 'contacts' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Contacts</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quality Rep <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.quality_rep}
                  onChange={(e) => updateField('quality_rep', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.quality_rep ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="Enter quality representative name"
                />
                {errors.quality_rep && (
                  <p className="mt-1 text-sm text-red-600">{errors.quality_rep}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quality Email <span className="text-red-600">*</span>
                </label>
                <input
                  type="email"
                  value={formData.quality_email}
                  onChange={(e) => updateField('quality_email', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.quality_email ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="quality@example.com"
                />
                {errors.quality_email && (
                  <p className="mt-1 text-sm text-red-600">{errors.quality_email}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  R&D Rep
                </label>
                <input
                  type="text"
                  value={formData.rd_rep}
                  onChange={(e) => updateField('rd_rep', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter R&D representative (optional)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sourcing Rep
                </label>
                <input
                  type="text"
                  value={formData.sourcing_rep}
                  onChange={(e) => updateField('sourcing_rep', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter sourcing representative (optional)"
                />
              </div>
            </div>
          )}

          {activeSection === 'part_info' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Part Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Part Number
                </label>
                <input
                  type="text"
                  value={formData.part_number}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-gray-600"
                />
                <p className="mt-1 text-xs text-gray-500">Pre-filled from PPAP record</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Part Description <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={formData.part_description}
                  onChange={(e) => updateField('part_description', e.target.value)}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.part_description ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="Enter detailed part description"
                />
                {errors.part_description && (
                  <p className="mt-1 text-sm text-red-600">{errors.part_description}</p>
                )}
              </div>

              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.parts_producible}
                    onChange={(e) => updateField('parts_producible', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Parts are producible <span className="text-red-600">*</span>
                  </span>
                </label>
              </div>
              {errors.parts_producible && (
                <p className="mt-1 text-sm text-red-600">{errors.parts_producible}</p>
              )}

              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.capability_met}
                    onChange={(e) => updateField('capability_met', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Capability requirements met <span className="text-red-600">*</span>
                  </span>
                </label>
              </div>
              {errors.capability_met && (
                <p className="mt-1 text-sm text-red-600">{errors.capability_met}</p>
              )}
            </div>
          )}

          {activeSection === 'drawing' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Drawing Data</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Drawing Number <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.drawing_number}
                  onChange={(e) => updateField('drawing_number', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.drawing_number ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="Enter drawing number"
                />
                {errors.drawing_number && (
                  <p className="mt-1 text-sm text-red-600">{errors.drawing_number}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Revision <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.revision}
                  onChange={(e) => updateField('revision', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.revision ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="e.g., Rev A, Rev 1"
                />
                {errors.revision && (
                  <p className="mt-1 text-sm text-red-600">{errors.revision}</p>
                )}
              </div>
            </div>
          )}

          {activeSection === 'shipment' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shipment Info</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sample Quantity <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.sample_quantity}
                  onChange={(e) => updateField('sample_quantity', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.sample_quantity ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="e.g., 100 pieces"
                />
                {errors.sample_quantity && (
                  <p className="mt-1 text-sm text-red-600">{errors.sample_quantity}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ship To Location <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ship_to_location}
                  onChange={(e) => updateField('ship_to_location', e.target.value)}
                  className={`w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 ${
                    errors.ship_to_location ? 'border-red-400' : 'border-gray-300'
                  }`}
                  placeholder="Enter destination location"
                />
                {errors.ship_to_location && (
                  <p className="mt-1 text-sm text-red-600">{errors.ship_to_location}</p>
                )}
              </div>
            </div>
          )}

          {activeSection === 'warrant' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Warrant Section</h3>
              <p className="text-sm text-gray-600 mb-4">
                All confirmations are required to advance to the next phase.
              </p>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={formData.drawing_understood}
                    onChange={(e) => updateField('drawing_understood', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Drawing is understood <span className="text-red-600">*</span>
                  </label>
                </div>
                {errors.drawing_understood && (
                  <p className="mt-1 text-sm text-red-600">{errors.drawing_understood}</p>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={formData.part_defined}
                    onChange={(e) => updateField('part_defined', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Part is properly defined <span className="text-red-600">*</span>
                  </label>
                </div>
                {errors.part_defined && (
                  <p className="mt-1 text-sm text-red-600">{errors.part_defined}</p>
                )}

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                  <input
                    type="checkbox"
                    checked={formData.packaging_met}
                    onChange={(e) => updateField('packaging_met', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Packaging requirements met <span className="text-red-600">*</span>
                  </label>
                </div>
                {errors.packaging_met && (
                  <p className="mt-1 text-sm text-red-600">{errors.packaging_met}</p>
                )}
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
            <button
              onClick={handleAdvancePhase}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Advancing Phase...' : 'Send to Next Phase →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
