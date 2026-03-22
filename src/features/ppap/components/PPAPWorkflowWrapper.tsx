'use client';

import { useState, useRef, useEffect } from 'react';
import { PPAPRecord, PPAPTask } from '@/src/types/database.types';
import { PhaseIndicator } from './PhaseIndicator';
import { InitiationForm } from './InitiationForm';
import { DocumentationForm } from './DocumentationForm';
import { SampleForm } from './SampleForm';
import { ReviewForm } from './ReviewForm';
import { WorkflowPhase, isValidWorkflowPhase, WORKFLOW_PHASE_LABELS } from '../constants/workflowPhases';
import { getNextAction } from '../utils/getNextAction';
import { getPhaseTasks } from '../utils/getPhaseTasks';

interface PPAPWorkflowWrapperProps {
  ppap: PPAPRecord;
  tasks: PPAPTask[];
}

export function PPAPWorkflowWrapper({ ppap, tasks }: PPAPWorkflowWrapperProps) {
  // Initialize phase from database, fallback to INITIATION if invalid
  const initialPhase = isValidWorkflowPhase(ppap.workflow_phase) 
    ? ppap.workflow_phase 
    : 'INITIATION';
  
  const [currentPhase, setCurrentPhase] = useState<WorkflowPhase>(initialPhase);
  const [documentationSection, setDocumentationSection] = useState<'checklist' | 'upload' | 'readiness' | 'confirmation' | undefined>(undefined);
  const activePhaseRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active phase on mount
  useEffect(() => {
    if (activePhaseRef.current) {
      setTimeout(() => {
        activePhaseRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  }, []);

  const nextActionData = getNextAction(ppap.workflow_phase, ppap.status);
  
  // Get phase tasks with data-driven completion
  // Note: Phase data is managed within child form components
  // Tasks will show completion based on data passed here
  const phaseTasksData = getPhaseTasks(currentPhase, {});
  
  const scrollToActivePhase = () => {
    if (activePhaseRef.current) {
      activePhaseRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleTaskClick = (taskId: string) => {
    // Map task IDs to documentation sections
    const taskSectionMap: Record<string, 'checklist' | 'upload' | 'readiness'> = {
      'prepare_documents': 'checklist',
      'markup_drawing': 'checklist',
      'dimensional_results': 'checklist',
      'upload_documents': 'upload',
    };

    const targetSection = taskSectionMap[taskId];
    if (targetSection && currentPhase === 'DOCUMENTATION') {
      setDocumentationSection(targetSection);
      scrollToActivePhase();
    }
  };

  return (
    <div className="space-y-6">
      {/* Next Action Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Next Action</h3>
            <p className="text-2xl font-bold text-gray-900">{nextActionData.nextAction || ''}</p>
            <p className="text-sm text-gray-600 mt-1">
              Current Phase: <span className="font-semibold">{WORKFLOW_PHASE_LABELS[currentPhase] || ''}</span>
            </p>
          </div>
          <button
            onClick={scrollToActivePhase}
            className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-md"
          >
            Go to Section →
          </button>
        </div>
      </div>

      <PhaseIndicator currentPhase={currentPhase} />

      {/* Phase Tasks Panel */}
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Tasks for this Phase</h3>
            <div className="mt-1">
              {phaseTasksData.phaseStatus === 'READY_TO_ADVANCE' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-300">
                  ✓ READY TO ADVANCE
                </span>
              )}
              {phaseTasksData.phaseStatus === 'IN_PROGRESS' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-800 border border-yellow-300">
                  ⚡ IN PROGRESS
                </span>
              )}
              {phaseTasksData.phaseStatus === 'COMPLETE' && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  ✓ COMPLETE
                </span>
              )}
            </div>
          </div>
          <div className="text-sm font-semibold text-gray-700">
            <span className="text-blue-600">{phaseTasksData.completedCount || 0}</span> of{' '}
            <span className="text-gray-900">{phaseTasksData.totalCount || 0}</span> tasks completed
          </div>
        </div>

        {phaseTasksData.tasks.length > 0 ? (
          <div className="space-y-3">
            {phaseTasksData.tasks.map((task, index) => {
              const isFirstIncomplete = !task.completed && phaseTasksData.tasks.slice(0, index).every(t => t.completed);
              const isClickable = currentPhase === 'DOCUMENTATION' && ['prepare_documents', 'markup_drawing', 'dimensional_results', 'upload_documents'].includes(task.id);
              return (
                <div
                  key={task.id}
                  onClick={() => isClickable && handleTaskClick(task.id)}
                  className={`flex items-start p-4 rounded-lg border-2 transition-all ${
                    task.completed
                      ? 'bg-green-50 border-green-200'
                      : isFirstIncomplete
                      ? 'bg-blue-50 border-blue-400 shadow-md'
                      : 'bg-gray-50 border-gray-200'
                  } ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-blue-500' : ''}`}
                >
                  <div className="flex items-center h-6">
                    <input
                      type="checkbox"
                      checked={!!task.completed}
                      readOnly
                      className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-default"
                    />
                  </div>
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <label className={`text-sm font-semibold ${
                        task.completed ? 'text-green-800 line-through' : 'text-gray-900'
                      }`}>
                        {task.label || ''}
                      </label>
                      {isFirstIncomplete && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-600 text-white">
                          NEXT
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p className="mt-1 text-xs text-gray-600">{task.description || ''}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">No tasks defined for this phase.</p>
        )}
      </div>
      
      {currentPhase === 'INITIATION' && (
        <div ref={activePhaseRef}>
          <InitiationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            ppapType={ppap.ppap_type}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'DOCUMENTATION' && (
        <div ref={activePhaseRef}>
          <DocumentationForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
            initialSection={documentationSection}
          />
        </div>
      )}

      {currentPhase === 'SAMPLE' && (
        <div ref={activePhaseRef}>
          <SampleForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'REVIEW' && (
        <div ref={activePhaseRef}>
          <ReviewForm
            ppapId={ppap.id}
            partNumber={ppap.part_number || ''}
            currentPhase={currentPhase}
            setPhase={setCurrentPhase}
          />
        </div>
      )}

      {currentPhase === 'COMPLETE' && (
        <div ref={activePhaseRef} className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">COMPLETE Phase</h2>
          <p className="text-green-700 font-medium">✓ PPAP workflow complete!</p>
        </div>
      )}
    </div>
  );
}
