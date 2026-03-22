'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { updateWorkflowPhase } from '../mutations/updateWorkflowPhase';
import { WorkflowPhase } from '../constants/workflowPhases';

interface SampleFormProps {
  ppapId: string;
  partNumber: string;
  currentPhase: WorkflowPhase;
  setPhase: (phase: WorkflowPhase) => void;
}

type Section = 'requirement' | 'shipment' | 'cost' | 'confirmation';

interface SampleData {
  samples_required: boolean;
  sample_quantity: string;
  ship_to: string;
  attention: string;
  carrier: string;
  tracking_number: string;
  estimated_arrival: string;
  has_cost: boolean;
  cost_amount: string;
  acknowledgement: boolean;
}

const SECTIONS = [
  { id: 'requirement', label: 'Sample Requirement' },
  { id: 'shipment', label: 'Shipment Information' },
  { id: 'cost', label: 'Cost Information' },
  { id: 'confirmation', label: 'Confirmation' },
] as const;

export function SampleForm({ ppapId, partNumber, currentPhase, setPhase }: SampleFormProps) {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>('requirement');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState<SampleData>({
    samples_required: false,
    sample_quantity: '',
    ship_to: '',
    attention: '',
    carrier: '',
    tracking_number: '',
    estimated_arrival: '',
    has_cost: false,
    cost_amount: '',
    acknowledgement: false,
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.acknowledgement) {
      newErrors.acknowledgement = 'You must acknowledge the submission';
    }

    if (formData.samples_required) {
      if (!formData.sample_quantity) {
        newErrors.sample_quantity = 'Sample quantity is required when samples are required';
      }
      if (!formData.estimated_arrival) {
        newErrors.estimated_arrival = 'Estimated arrival date is required when samples are required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    setErrors({});
    setSuccessMessage('');

    if (!validateForm()) {
      setErrors(prev => ({
        ...prev,
        _form: 'Please complete all required fields',
      }));
      return;
    }

    setLoading(true);

    try {
      // Log SAMPLE_SUBMITTED event
      await logEvent({
        ppap_id: ppapId,
        event_type: 'SAMPLE_SUBMITTED',
        event_data: {
          samples_required: formData.samples_required,
          sample_quantity: formData.sample_quantity ? parseInt(formData.sample_quantity, 10) : null,
          ship_to: formData.ship_to || null,
          attention: formData.attention || null,
          carrier: formData.carrier || null,
          tracking_number: formData.tracking_number || null,
          estimated_arrival: formData.estimated_arrival || null,
          has_cost: formData.has_cost,
          cost_amount: formData.cost_amount ? parseFloat(formData.cost_amount) : null,
          all_form_data: formData,
        },
        actor: 'Matt',
        actor_role: 'Engineer',
      });

      // Persist phase change to database
      await updateWorkflowPhase({
        ppapId,
        fromPhase: currentPhase,
        toPhase: 'REVIEW',
        actor: 'Matt',
        additionalData: {
          sample_data: formData,
        },
      });

      setSuccessMessage('✓ Sample phase completed! Advancing to Review phase...');
      
      // Refresh UI to reflect status/phase change
      router.refresh();
      
      // Update UI state after successful database update
      setTimeout(() => {
        setPhase('REVIEW');
      }, 1500);
    } catch (error) {
      console.error('Failed to submit sample information:', error);
      setErrors({ 
        _form: error instanceof Error 
          ? `Failed to submit sample information: ${error.message}` 
          : 'Failed to submit sample information. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof SampleData, value: string | boolean) => {
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
    <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-xl shadow-sm">
      <div className="border-b border-gray-200 px-8 py-6">
        <h2 className="text-2xl font-bold text-gray-900">Sample Phase</h2>
        <p className="text-sm text-gray-600 mt-1">
          Part Number: <span className="font-medium">{partNumber || ''}</span>
        </p>
      </div>

      <div className="flex">
        {/* Sidebar Navigation */}
        <div className="w-64 border-r border-gray-200 bg-gray-50">
          <nav className="p-4 space-y-1">
            {SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as Section)}
                className={`w-full text-left px-4 py-2 rounded text-sm font-medium transition-colors ${
                  activeSection === section.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Form Content */}
        <div className="flex-1 p-6">
          {errors._form && (
            <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">
              {errors._form || ''}
            </div>
          )}

          {/* Sample Requirement Section */}
          {activeSection === 'requirement' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Sample Requirement</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="samples_required"
                      checked={!!formData.samples_required}
                      onChange={(e) => updateField('samples_required', e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="samples_required" className="ml-2 text-sm text-gray-700">
                      <span className="font-medium">Physical samples are required for this PPAP</span>
                    </label>
                  </div>

                  {formData.samples_required && (
                    <div className="ml-6 p-4 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-sm text-blue-700">
                        ℹ️ Samples are required. Please complete the shipment information in the next section.
                      </p>
                    </div>
                  )}

                  {!formData.samples_required && (
                    <div className="ml-6 p-4 bg-gray-50 border border-gray-200 rounded">
                      <p className="text-sm text-gray-600">
                        If no physical samples are required, you can skip the shipment information section.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Shipment Information Section */}
          {activeSection === 'shipment' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Shipment Information</h3>
                
                {!formData.samples_required && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded mb-4">
                    <p className="text-sm text-yellow-800">
                      ⚠️ Samples are not marked as required. This section is optional.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sample Quantity {formData.samples_required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.sample_quantity || ''}
                      onChange={(e) => updateField('sample_quantity', e.target.value)}
                      placeholder="Enter number of samples"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.sample_quantity && (
                      <p className="mt-1 text-sm text-red-600">{errors.sample_quantity || ''}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ship To Location
                    </label>
                    <input
                      type="text"
                      value={formData.ship_to || ''}
                      onChange={(e) => updateField('ship_to', e.target.value)}
                      placeholder="e.g., Rheem Manufacturing - Fort Smith, AR"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Attention / Contact
                    </label>
                    <input
                      type="text"
                      value={formData.attention || ''}
                      onChange={(e) => updateField('attention', e.target.value)}
                      placeholder="Name of person receiving samples"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Carrier
                    </label>
                    <input
                      type="text"
                      value={formData.carrier || ''}
                      onChange={(e) => updateField('carrier', e.target.value)}
                      placeholder="e.g., FedEx, UPS, USPS"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tracking Number
                    </label>
                    <input
                      type="text"
                      value={formData.tracking_number || ''}
                      onChange={(e) => updateField('tracking_number', e.target.value)}
                      placeholder="Enter tracking number"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Estimated Arrival Date {formData.samples_required && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      type="date"
                      value={formData.estimated_arrival || ''}
                      onChange={(e) => updateField('estimated_arrival', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {errors.estimated_arrival && (
                      <p className="mt-1 text-sm text-red-600">{errors.estimated_arrival || ''}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cost Information Section */}
          {activeSection === 'cost' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Cost Information</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      id="has_cost"
                      checked={!!formData.has_cost}
                      onChange={(e) => updateField('has_cost', e.target.checked)}
                      className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="has_cost" className="ml-2 text-sm text-gray-700">
                      <span className="font-medium">There is a cost associated with sample production/shipping</span>
                    </label>
                  </div>

                  {formData.has_cost && (
                    <div className="p-8 space-y-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Cost Amount ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.cost_amount || ''}
                          onChange={(e) => updateField('cost_amount', e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Section */}
          {activeSection === 'confirmation' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-4">Confirmation</h3>
                
                <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Sample Submission Summary</h4>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-blue-700">Samples Required:</dt>
                      <dd className="font-medium text-blue-900">
                        {formData.samples_required ? 'Yes' : 'No'}
                      </dd>
                    </div>
                    {formData.samples_required && (
                      <>
                        <div className="flex justify-between">
                          <dt className="text-blue-700">Sample Quantity:</dt>
                          <dd className="font-medium text-blue-900">
                            {formData.sample_quantity || 'Not specified'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-blue-700">Estimated Arrival:</dt>
                          <dd className="font-medium text-blue-900">
                            {formData.estimated_arrival || 'Not specified'}
                          </dd>
                        </div>
                        {formData.ship_to && (
                          <div className="flex justify-between">
                            <dt className="text-blue-700">Ship To:</dt>
                            <dd className="font-medium text-blue-900">
                              {formData.ship_to}
                            </dd>
                          </div>
                        )}
                      </>
                    )}
                    <div className="flex justify-between">
                      <dt className="text-blue-700">Has Cost:</dt>
                      <dd className="font-medium text-blue-900">
                        {formData.has_cost ? `Yes ($${formData.cost_amount || '0.00'})` : 'No'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="flex items-start p-4 bg-gray-50 border border-gray-200 rounded">
                  <input
                    type="checkbox"
                    id="acknowledgement"
                    checked={!!formData.acknowledgement}
                    onChange={(e) => updateField('acknowledgement', e.target.checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="acknowledgement" className="ml-2 text-sm text-gray-700">
                    <span className="font-medium">I acknowledge</span> that the sample information provided is accurate
                    and complete to the best of my knowledge. <span className="text-red-500">*</span>
                  </label>
                </div>
                {errors.acknowledgement && (
                  <p className="mt-1 text-sm text-red-600">{errors.acknowledgement || ''}</p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between items-center">
            <div>
              {successMessage && (
                <div className="text-sm font-semibold text-green-800 bg-green-100 border border-green-300 px-6 py-3 rounded-lg shadow-sm">
                  {successMessage || ''}
                </div>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Sample Info & Advance to Review →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
