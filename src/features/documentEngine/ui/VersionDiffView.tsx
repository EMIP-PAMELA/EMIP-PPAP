/**
 * Phase 36: Version Diff View Component
 * 
 * Displays field-level and mapping-level differences between two document versions.
 * Read-only visualization for version comparison.
 */

import React from 'react';
import { VersionComparison, formatFieldValue, formatMapping, getChangedFields, getChangedMappings, analyzeImpact, ImpactResult } from '../persistence/versionDiffService';

interface VersionDiffViewProps {
  comparison: VersionComparison;
  onClose: () => void;
}

export function VersionDiffView({ comparison, onClose }: VersionDiffViewProps) {
  const changedFields = getChangedFields(comparison);
  const changedMappings = getChangedMappings(comparison);
  const impactAnalysis = analyzeImpact(comparison);
  
  const hasChanges = Object.keys(changedFields).length > 0 || Object.keys(changedMappings).length > 0;
  const hasImpacts = impactAnalysis.impacts.length > 0;
  
  // Helper to get impact icon and color
  const getImpactStyle = (impact: ImpactResult) => {
    switch (impact.impactType) {
      case 'derived_change':
        return { icon: '🔗', bgColor: 'bg-purple-50', textColor: 'text-purple-800', borderColor: 'border-purple-200' };
      case 'mapping_change':
        return { icon: '🔄', bgColor: 'bg-blue-50', textColor: 'text-blue-800', borderColor: 'border-blue-200' };
      case 'value_change':
        return impact.severity === 'high' 
          ? { icon: '⚠️', bgColor: 'bg-red-50', textColor: 'text-red-800', borderColor: 'border-red-200' }
          : { icon: '📝', bgColor: 'bg-yellow-50', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' };
      default:
        return { icon: 'ℹ️', bgColor: 'bg-gray-50', textColor: 'text-gray-800', borderColor: 'border-gray-200' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-indigo-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Version Comparison</h2>
            <p className="text-sm text-indigo-100 mt-1">
              Version {comparison.oldVersion.versionNumber} → Version {comparison.newVersion.versionNumber}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-indigo-200 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {!hasChanges && (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium">No changes detected</p>
              <p className="text-sm mt-2">These versions are identical</p>
            </div>
          )}

          {hasChanges && (
            <div className="space-y-6">
              {/* Phase 37: Impact Summary */}
              {hasImpacts && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Impact Summary ({impactAnalysis.impacts.length})
                  </h3>
                  
                  <div className="space-y-2">
                    {impactAnalysis.impacts.map((impact, index) => {
                      const style = getImpactStyle(impact);
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${style.bgColor} ${style.borderColor}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-lg">{style.icon}</span>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`font-medium ${style.textColor}`}>
                                  {impact.field}
                                </span>
                                {impact.severity && (
                                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${
                                    impact.severity === 'high' ? 'bg-red-100 text-red-700' :
                                    impact.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-blue-100 text-blue-700'
                                  }`}>
                                    {impact.severity.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <p className={`text-sm ${style.textColor}`}>
                                {impact.description}
                              </p>
                              {impact.relatedFields && impact.relatedFields.length > 0 && (
                                <p className="text-xs text-gray-600 mt-1">
                                  Related: {impact.relatedFields.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Field Changes */}
              {Object.keys(changedFields).length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Field Changes ({Object.keys(changedFields).length})
                  </h3>
                  
                  <div className="space-y-4">
                    {Object.entries(changedFields).map(([fieldKey, diff]) => (
                      <div key={fieldKey} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <span className="font-medium text-gray-900">{fieldKey}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 divide-x divide-gray-200">
                          {/* Old Value */}
                          <div className="p-4 bg-red-50">
                            <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">
                              Version {comparison.oldVersion.versionNumber}
                            </div>
                            <div className="text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
                              {formatFieldValue(diff.oldValue)}
                            </div>
                          </div>
                          
                          {/* New Value */}
                          <div className="p-4 bg-green-50">
                            <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">
                              Version {comparison.newVersion.versionNumber}
                            </div>
                            <div className="text-sm text-gray-900 font-mono whitespace-pre-wrap break-words">
                              {formatFieldValue(diff.newValue)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mapping Changes */}
              {Object.keys(changedMappings).length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                    </svg>
                    Mapping Changes ({Object.keys(changedMappings).length})
                  </h3>
                  
                  <div className="space-y-4">
                    {Object.entries(changedMappings).map(([fieldKey, diff]) => (
                      <div key={fieldKey} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <span className="font-medium text-gray-900">{fieldKey}</span>
                        </div>
                        
                        <div className="grid grid-cols-2 divide-x divide-gray-200">
                          {/* Old Mapping */}
                          <div className="p-4 bg-red-50">
                            <div className="text-xs font-medium text-red-700 uppercase tracking-wide mb-2">
                              Version {comparison.oldVersion.versionNumber}
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                              {formatMapping(diff.oldMapping)}
                            </div>
                          </div>
                          
                          {/* New Mapping */}
                          <div className="p-4 bg-green-50">
                            <div className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">
                              Version {comparison.newVersion.versionNumber}
                            </div>
                            <div className="text-sm text-gray-900 font-mono">
                              {formatMapping(diff.newMapping)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {hasChanges && (
              <span>
                {Object.keys(changedFields).length} field(s) • {Object.keys(changedMappings).length} mapping(s) changed
                {hasImpacts && <> • {impactAnalysis.impacts.length} impact(s) detected</>}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
