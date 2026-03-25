'use client';

import { Validation } from '../types/validation';
import { isPostAckReady } from '../utils/validationHelpers';

// FUTURE:
// - Export compiled PDF package
// - Pull documents from SharePoint
// - Upload to Reliance
// - Template-specific packaging (Trane vs Rheem)

interface SubmissionItem {
  id: string;
  name: string;
  required: boolean;
  validationId?: string;
}

const SUBMISSION_ITEMS: SubmissionItem[] = [
  { id: 'psw', name: 'PSW Document', required: true },
  { id: 'balloon', name: 'Ballooned Drawing', required: true },
  { id: 'control_plan', name: 'Control Plan', required: true, validationId: 'val-006' },
  { id: 'pfmea', name: 'PFMEA', required: true, validationId: 'val-007' },
  { id: 'dfmea', name: 'DFMEA', required: true, validationId: 'val-008' },
  { id: 'dimensional', name: 'Dimensional Results', required: true, validationId: 'val-012' },
  { id: 'material', name: 'Material Certifications', required: true, validationId: 'val-011' },
  { id: 'msa', name: 'MSA', required: true, validationId: 'val-010' },
  { id: 'capability', name: 'Capability Studies', required: true, validationId: 'val-013' },
];

interface Props {
  validations: Validation[];
}

export default function PPAPSubmissionPanel({ validations }: Props) {
  const getItemStatus = (item: SubmissionItem): 'ready' | 'missing' => {
    if (!item.validationId) {
      return 'missing';
    }
    
    const validation = validations.find(v => v.id === item.validationId);
    if (!validation) {
      return 'missing';
    }
    
    // Item is ready if validation is complete or approved
    return validation.status === 'complete' || validation.status === 'approved' ? 'ready' : 'missing';
  };

  const itemStatuses = SUBMISSION_ITEMS.map(item => ({
    ...item,
    status: getItemStatus(item),
  }));

  const readyCount = itemStatuses.filter(item => item.status === 'ready').length;
  const totalCount = SUBMISSION_ITEMS.length;
  const packageReady = isPostAckReady(validations);

  const handleGeneratePackage = () => {
    alert('Submission package generated (demo)\n\nFuture: Export compiled PDF, upload to Reliance');
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Submission Package</h2>
        <span className="text-sm font-medium text-gray-600">
          {readyCount} / {totalCount} Complete
        </span>
      </div>

      <div className="space-y-2 mb-6">
        {itemStatuses.map((item) => (
          <div
            key={item.id}
            className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200"
          >
            <span className="text-xl">
              {item.status === 'ready' ? (
                <span className="text-green-600">✓</span>
              ) : (
                <span className="text-gray-400">☐</span>
              )}
            </span>
            <div className="flex-1">
              <span className={`text-sm font-medium ${
                item.status === 'ready' ? 'text-gray-900' : 'text-gray-500'
              }`}>
                {item.name}
              </span>
            </div>
            {item.status === 'ready' && (
              <span className="text-xs text-green-600 font-medium">Ready</span>
            )}
          </div>
        ))}
      </div>

      <div className="relative">
        <button
          onClick={handleGeneratePackage}
          disabled={!packageReady}
          className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
            packageReady
              ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
          title={
            !packageReady
              ? 'All validations must be approved before generating package'
              : 'Generate submission package'
          }
        >
          Generate Submission Package
        </button>
        {!packageReady && (
          <p className="mt-2 text-xs text-gray-500 italic text-center">
            All validations must be approved before generating package
          </p>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Demo Mode:</span> Submission items linked to validation status.
          Future: Export PDF, pull from SharePoint, upload to Reliance.
        </p>
      </div>
    </div>
  );
}
