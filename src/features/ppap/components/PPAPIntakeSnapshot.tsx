'use client';

// Phase 3E future:
// This section will evolve into full intake workflow
// Including quote validation, BOM checks, material planning, plant assignment

interface IntakeData {
  quoteStatus: 'confirmed' | 'pending';
  toolingStatus: 'validated' | 'pending';
  bomStatus: 'validated' | 'pending';
  materialRisk: 'none' | 'risk';
  plantAssigned: string;
}

const MOCK_INTAKE_DATA: IntakeData = {
  quoteStatus: 'confirmed',
  toolingStatus: 'validated',
  bomStatus: 'pending',
  materialRisk: 'risk',
  plantAssigned: 'Van Buren',
};

const getStatusIcon = (status: string): string => {
  if (status === 'confirmed' || status === 'validated' || status === 'none') return '✓';
  if (status === 'pending') return '⏳';
  if (status === 'risk') return '⚠️';
  return '•';
};

const getStatusColor = (status: string): string => {
  if (status === 'confirmed' || status === 'validated' || status === 'none') return 'text-green-600';
  if (status === 'pending') return 'text-yellow-600';
  if (status === 'risk') return 'text-orange-600';
  return 'text-gray-600';
};

const getStatusText = (status: string): string => {
  if (status === 'confirmed') return 'Confirmed';
  if (status === 'validated') return 'Validated';
  if (status === 'pending') return 'Pending';
  if (status === 'none') return 'No Risk';
  if (status === 'risk') return 'Risk Identified';
  return status;
};

export default function PPAPIntakeSnapshot() {
  const data = MOCK_INTAKE_DATA;

  const renderItem = (label: string, status: string) => {
    return (
      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
        <span className="text-sm font-medium text-gray-700">{label}:</span>
        <div className="flex items-center space-x-2">
          <span className={`text-lg ${getStatusColor(status)}`}>
            {getStatusIcon(status)}
          </span>
          <span className={`text-sm font-semibold ${getStatusColor(status)}`}>
            {getStatusText(status)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Intake & Readiness</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {renderItem('Quote Status', data.quoteStatus)}
        {renderItem('Tooling', data.toolingStatus)}
        {renderItem('BOM', data.bomStatus)}
        {renderItem('Material Risk', data.materialRisk)}
      </div>

      <div className="p-3 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Plant:</span>
          <span className="text-sm font-semibold text-gray-900">{data.plantAssigned}</span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">
          <span className="font-medium">Demo Mode:</span> Intake data shows mock readiness
          signals. Future: Full intake workflow integration.
        </p>
      </div>
    </div>
  );
}
