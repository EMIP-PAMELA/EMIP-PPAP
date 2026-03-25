'use client';

import { IntakeRecord, isReadyForPPAP } from '../types/intake';

// Mock intake data - Phase 3E.4
const MOCK_INTAKE_RECORDS: IntakeRecord[] = [
  {
    id: 'INT-001',
    part_number: 'P-12345',
    customer_name: 'Trane',
    quoteStatus: 'confirmed',
    toolingStatus: 'validated',
    bomStatus: 'validated',
    materialRisk: 'none',
    plantAssigned: 'Van Buren',
  },
  {
    id: 'INT-002',
    part_number: 'P-23456',
    customer_name: 'Rheem',
    quoteStatus: 'confirmed',
    toolingStatus: 'validated',
    bomStatus: 'pending',
    materialRisk: 'none',
    plantAssigned: 'Clarksville',
  },
  {
    id: 'INT-003',
    part_number: 'P-34567',
    customer_name: 'Trane',
    quoteStatus: 'confirmed',
    toolingStatus: 'validated',
    bomStatus: 'validated',
    materialRisk: 'none',
    plantAssigned: 'Columbia',
  },
  {
    id: 'INT-004',
    part_number: 'P-45678',
    customer_name: 'Rheem',
    quoteStatus: 'pending',
    toolingStatus: 'validated',
    bomStatus: 'validated',
    materialRisk: 'none',
    plantAssigned: 'Van Buren',
  },
  {
    id: 'INT-005',
    part_number: 'P-56789',
    customer_name: 'Trane',
    quoteStatus: 'confirmed',
    toolingStatus: 'pending',
    bomStatus: 'validated',
    materialRisk: 'risk',
    plantAssigned: 'Clarksville',
  },
  {
    id: 'INT-006',
    part_number: 'P-67890',
    customer_name: 'Rheem',
    quoteStatus: 'confirmed',
    toolingStatus: 'validated',
    bomStatus: 'validated',
    materialRisk: 'none',
    plantAssigned: null,
  },
  {
    id: 'INT-007',
    part_number: 'P-78901',
    customer_name: 'Trane',
    quoteStatus: 'confirmed',
    toolingStatus: 'validated',
    bomStatus: 'validated',
    materialRisk: 'none',
    plantAssigned: 'Van Buren',
  },
  {
    id: 'INT-008',
    part_number: 'P-89012',
    customer_name: 'Ruud',
    quoteStatus: 'confirmed',
    toolingStatus: 'validated',
    bomStatus: 'pending',
    materialRisk: 'risk',
    plantAssigned: 'Columbia',
  },
];

export default function PPAPIntakeQueue() {
  const handleCreatePPAP = (intake: IntakeRecord) => {
    alert(`Create PPAP for ${intake.part_number}\n\nFuture: Navigate to PPAP creation flow`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Intake Queue</h1>
        <p className="text-gray-600">
          Review intake readiness before creating PPAPs. All prerequisites must be met.
        </p>
      </div>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Part Number
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Plant
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Readiness Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {MOCK_INTAKE_RECORDS.map((intake) => {
                const ready = isReadyForPPAP(intake);
                return (
                  <tr key={intake.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {intake.part_number}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {intake.customer_name}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {intake.plantAssigned || (
                        <span className="text-gray-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ready ? (
                        <span className="text-sm font-semibold text-green-600">✅ Ready</span>
                      ) : (
                        <span className="text-sm font-medium text-red-600">❌ Not Ready</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {ready ? (
                        <button
                          onClick={() => handleCreatePPAP(intake)}
                          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition-colors"
                        >
                          Create PPAP
                        </button>
                      ) : (
                        <span className="text-sm text-gray-500 italic">
                          Complete prerequisites
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 3F.12: Real state-driven UI - removed demo mode banner */}
    </div>
  );
}
