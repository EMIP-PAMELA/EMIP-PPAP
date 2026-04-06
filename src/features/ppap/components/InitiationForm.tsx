'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updatePPAPState } from '../utils/updatePPAPState';

interface InitiationFormProps {
  ppapId: string;
  partNumber: string;
  ppapType?: string | null;
  isReadOnly?: boolean;
}

interface WarrantValidation {
  drawing_understood: boolean;
  part_defined: boolean;
  packaging_met: boolean;
}

export function InitiationForm({ ppapId, partNumber, ppapType, isReadOnly = false }: InitiationFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [validations, setValidations] = useState<WarrantValidation>({
    drawing_understood: false,
    part_defined: false,
    packaging_met: false,
  });

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!validations.drawing_understood) {
      newErrors.drawing_understood = 'Must confirm drawing is understood';
    }
    if (!validations.part_defined) {
      newErrors.part_defined = 'Must confirm part is defined';
    }
    if (!validations.packaging_met) {
      newErrors.packaging_met = 'Must confirm packaging is met';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAdvancePhase = async () => {
    setErrors({});

    if (!validateForm()) {
      setErrors(prev => ({
        ...prev,
        _form: 'Please complete all required confirmations',
      }));
      return;
    }

    setLoading(true);

    try {
      // V3.4 Phase 6: Manual transition removed - state derives from validation completion
      // console.log('Phase 3F.2.4: Transitioning INITIATION → READY_TO_ACKNOWLEDGE');
      
      const result = await updatePPAPState(
        ppapId,
        'READY_TO_ACKNOWLEDGE',
        'Matt',
        'engineer'
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to update state');
      }

      console.log('Phase 3F.2.4: State transition successful, UI will advance to DOCUMENTATION');
      router.refresh();
      
    } catch (error) {
      console.error('Failed to advance phase:', error);
      setErrors({ 
        _form: error instanceof Error 
          ? `Failed to advance phase: ${error.message}` 
          : 'Failed to advance phase. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateValidation = (field: keyof WarrantValidation, value: boolean) => {
    setValidations(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const getPPAPTypeLabel = (type?: string | null): string => {
    if (!type) return 'Not Specified';
    switch (type) {
      case 'NPI': return 'New Product Introduction (NPI)';
      case 'CHANGE': return 'Engineering Change';
      case 'MAINTENANCE': return 'Production / Maintenance';
      default: return type;
    }
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-300 rounded-xl shadow-sm p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Initiation Phase - Validation & Confirmation</h2>
          <p className="text-sm text-gray-600 mt-1">Review PPAP details and confirm readiness to proceed</p>
        </div>
        {ppapType && (
          <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">PPAP Type</span>
            <p className="text-sm font-medium text-blue-900 mt-0.5">{getPPAPTypeLabel(ppapType)}</p>
          </div>
        )}
      </div>

      {/* V3.3A.2: Read-Only PPAP Summary */}
      <div className="mb-8 bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          PPAP Information Summary
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Part Number</p>
            <p className="text-sm font-medium text-gray-900">{partNumber || 'Not specified'}</p>
          </div>
          
          <div className="p-3 bg-gray-50 rounded border border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">PPAP ID</p>
            <p className="text-sm font-mono text-gray-900">{ppapId}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
          <p className="text-xs font-semibold text-blue-700 mb-1">ℹ️ Note</p>
          <p className="text-sm text-blue-900">
            All project details were captured during PPAP creation. Review the information above and complete the validation checklist below to proceed.
          </p>
        </div>
      </div>

      {/* Form Errors */}
      {errors._form && (
        <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-800 font-medium">
          {errors._form}
        </div>
      )}

      {/* V3.3A.2: Warrant Validation Checklist */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">Validation Checklist</h3>
        <p className="text-sm text-gray-600 mb-6">
          All confirmations are required to advance to the Documentation Phase.
        </p>
        
        <div className="space-y-4">
          <div className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
            validations.drawing_understood 
              ? 'bg-green-50 border-green-300' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <input
              type="checkbox"
              id="drawing_understood"
              checked={validations.drawing_understood}
              onChange={(e) => updateValidation('drawing_understood', e.target.checked)}
              disabled={isReadOnly}
              className={`mt-0.5 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 ${
                isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
            <label htmlFor="drawing_understood" className="flex-1 cursor-pointer">
              <span className="text-sm font-semibold text-gray-900">
                Drawing is understood <span className="text-red-600">*</span>
              </span>
              <p className="text-xs text-gray-600 mt-1">
                Confirm that all engineering drawings and specifications are clear and understood
              </p>
            </label>
            {validations.drawing_understood && (
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          {errors.drawing_understood && (
            <p className="ml-8 text-sm text-red-600">{errors.drawing_understood}</p>
          )}

          <div className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
            validations.part_defined 
              ? 'bg-green-50 border-green-300' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <input
              type="checkbox"
              id="part_defined"
              checked={validations.part_defined}
              onChange={(e) => updateValidation('part_defined', e.target.checked)}
              disabled={isReadOnly}
              className={`mt-0.5 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 ${
                isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
            <label htmlFor="part_defined" className="flex-1 cursor-pointer">
              <span className="text-sm font-semibold text-gray-900">
                Part is properly defined <span className="text-red-600">*</span>
              </span>
              <p className="text-xs text-gray-600 mt-1">
                Confirm that part specifications, materials, and requirements are clearly defined
              </p>
            </label>
            {validations.part_defined && (
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          {errors.part_defined && (
            <p className="ml-8 text-sm text-red-600">{errors.part_defined}</p>
          )}

          <div className={`flex items-start gap-3 p-4 rounded-lg border-2 transition-all ${
            validations.packaging_met 
              ? 'bg-green-50 border-green-300' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <input
              type="checkbox"
              id="packaging_met"
              checked={validations.packaging_met}
              onChange={(e) => updateValidation('packaging_met', e.target.checked)}
              disabled={isReadOnly}
              className={`mt-0.5 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 ${
                isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
            />
            <label htmlFor="packaging_met" className="flex-1 cursor-pointer">
              <span className="text-sm font-semibold text-gray-900">
                Packaging requirements met <span className="text-red-600">*</span>
              </span>
              <p className="text-xs text-gray-600 mt-1">
                Confirm that packaging specifications and requirements are understood and achievable
              </p>
            </label>
            {validations.packaging_met && (
              <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          {errors.packaging_met && (
            <p className="ml-8 text-sm text-red-600">{errors.packaging_met}</p>
          )}
        </div>
      </div>

      {/* Action Button */}
      <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end">
        <button
          onClick={handleAdvancePhase}
          disabled={loading || isReadOnly}
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Confirming...
            </>
          ) : (
            <>
              Confirm & Move to Documentation Phase
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
