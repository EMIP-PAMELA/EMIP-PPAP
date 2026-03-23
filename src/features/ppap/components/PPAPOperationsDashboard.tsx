'use client';

import { useState, useEffect } from 'react';
import { Joyride, Step, STATUS } from 'react-joyride';
import { PPAPRecord, PPAPEvent } from '@/src/types/database.types';
import { supabase } from '@/src/lib/supabaseClient';
import { logEvent } from '@/src/features/events/mutations';
import { formatDate } from '@/src/lib/utils';
import { WORKFLOW_PHASE_LABELS, WORKFLOW_PHASES } from '../constants/workflowPhases';
import { getNextAction, getPriorityColor, getPriorityBackground } from '../utils/getNextAction';
import Link from 'next/link';

interface PPAPOperationsDashboardProps {
  ppaps: PPAPRecord[];
}

type SortMode = 'default' | 'bottleneck';

// Safe helpers for reading event_data fields (fixes TypeScript unknown type errors)
function getEventDataValue(eventData: unknown, key: string): unknown {
  if (!eventData || typeof eventData !== 'object') return undefined;
  return (eventData as Record<string, unknown>)[key];
}

function getEventDataString(eventData: unknown, key: string): string {
  const value = getEventDataValue(eventData, key);
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

export function PPAPOperationsDashboard({ ppaps: initialPpaps }: PPAPOperationsDashboardProps) {
  const [ppaps, setPpaps] = useState<PPAPRecord[]>(initialPpaps);
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPhase, setFilterPhase] = useState<string>('');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [selectedPpapId, setSelectedPpapId] = useState<string | null>(null);
  const [events, setEvents] = useState<PPAPEvent[]>([]);
  const [adminNote, setAdminNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [runTour, setRunTour] = useState(false);

  // Tour configuration with value-focused messaging
  const tourSteps: Step[] = [
    {
      target: '[data-tour="dashboard-summary"]',
      content: 'This is your PPAP command center. Track active workload, completed PPAPs, and items needing immediate attention—all in one view.',
    },
    {
      target: '[data-tour="dashboard-filters"]',
      content: 'Use filters to focus instantly on the PPAPs that need your attention. Narrow by customer, status, or phase to prioritize what matters now.',
    },
    {
      target: '[data-tour="active-ppaps"]',
      content: 'Current PPAP work is visible here. See status, phase, ownership, and bottlenecks in one place—no more hunting through emails or spreadsheets.',
    },
    {
      target: '[data-tour="next-action"]',
      content: 'The system shows what needs to happen next for each PPAP. This reduces ambiguity and keeps work moving forward.',
    },
    {
      target: '[data-tour="phase-progress"]',
      content: 'Instant visibility into where each PPAP stands in the workflow. Helps prevent missed steps and hidden delays.',
    },
    {
      target: '[data-tour="continue-work"]',
      content: 'Jump directly into the live workflow for any PPAP. Bridge from high-level oversight into hands-on execution.',
    },
    {
      target: '[data-tour="management-controls"]',
      content: 'Enable coordination, assignments, and issue visibility across teams. Keep communication tied to the PPAP record instead of scattered in email.',
    },
    {
      target: '[data-tour="dashboard-summary"]',
      content: 'This system centralizes PPAP tracking, documentation, markup, and communication in one place. Designed to keep engineering, quality, quoting, and management aligned.',
    },
  ];

  const handleTourCallback = (data: any) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRunTour(false);
    }
  };

  // Get unique filter values
  const customers = Array.from(new Set(ppaps.map(p => p.customer_name).filter(Boolean)));
  const statuses = Array.from(new Set(ppaps.map(p => p.status).filter(Boolean)));
  const phases = Array.from(new Set(ppaps.map(p => p.workflow_phase).filter(Boolean)));

  // Filter PPAPs
  const filteredPpaps = ppaps.filter(ppap => {
    if (filterCustomer && ppap.customer_name !== filterCustomer) return false;
    if (filterStatus && ppap.status !== filterStatus) return false;
    if (filterPhase && ppap.workflow_phase !== filterPhase) return false;
    return true;
  });

  // Helper: Check if PPAP is stagnant (assigned but phase not moving)
  const isStagnant = (ppap: PPAPRecord): boolean => {
    if (!ppap.assigned_to) return false;
    
    // Check if updated recently (within 7 days)
    const daysSinceUpdate = (Date.now() - new Date(ppap.updated_at).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate > 7;
  };

  // Sort by bottleneck priority
  const sortByBottleneck = (ppapList: PPAPRecord[]): PPAPRecord[] => {
    return [...ppapList].sort((a, b) => {
      const aNextAction = getNextAction(a.workflow_phase, a.status);
      const bNextAction = getNextAction(b.workflow_phase, b.status);
      
      // Priority order: urgent > warning > normal
      const priorityOrder = { urgent: 0, warning: 1, normal: 2 };
      return priorityOrder[aNextAction.priority] - priorityOrder[bNextAction.priority];
    });
  };

  // Group PPAPs
  let activePpaps = filteredPpaps.filter(p => p.workflow_phase !== 'COMPLETE');
  const completedPpaps = filteredPpaps.filter(p => p.workflow_phase === 'COMPLETE');
  
  // Apply bottleneck sorting if enabled
  if (sortMode === 'bottleneck') {
    activePpaps = sortByBottleneck(activePpaps);
  }

  // Fetch events for selected PPAP
  useEffect(() => {
    if (!selectedPpapId) {
      setEvents([]);
      return;
    }

    const fetchEvents = async () => {
      const { data, error } = await supabase
        .from('ppap_events')
        .select('*')
        .eq('ppap_id', selectedPpapId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setEvents(data as PPAPEvent[]);
      }
    };

    fetchEvents();
  }, [selectedPpapId]);

  const handleAssignment = async (ppapId: string, assignedTo: string) => {
    try {
      // Update assignment
      await supabase
        .from('ppap_records')
        .update({ assigned_to: assignedTo })
        .eq('id', ppapId);

      // Log event
      await logEvent({
        ppap_id: ppapId,
        event_type: 'ASSIGNED',
        event_data: {
          assigned_to: assignedTo,
          previous: ppaps.find(p => p.id === ppapId)?.assigned_to,
        },
        actor: 'Admin',
        actor_role: 'Administrator',
      });

      // Update local state
      setPpaps(ppaps.map(p => 
        p.id === ppapId ? { ...p, assigned_to: assignedTo } : p
      ));

      alert('Assignment updated successfully');
    } catch (error) {
      console.error('Failed to update assignment:', error);
      alert('Failed to update assignment');
    }
  };

  const handleAddNote = async () => {
    if (!selectedPpapId || !adminNote.trim()) return;

    setAddingNote(true);
    try {
      await logEvent({
        ppap_id: selectedPpapId,
        event_type: 'CONVERSATION_ADDED',
        event_data: {
          note: adminNote,
          admin_note: true,
        },
        actor: 'Admin',
        actor_role: 'Administrator',
      });

      // Refresh events
      const { data } = await supabase
        .from('ppap_events')
        .select('*')
        .eq('ppap_id', selectedPpapId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (data) {
        setEvents(data as PPAPEvent[]);
      }

      setAdminNote('');
      alert('Admin note added successfully');
    } catch (error) {
      console.error('Failed to add note:', error);
      alert('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'ASSIGNED':
        return '👤';
      case 'PHASE_ADVANCED':
        return '➡️';
      case 'DOCUMENT_ADDED':
        return '📄';
      case 'CONVERSATION_ADDED':
        return '💬';
      case 'STATUS_CHANGED':
        return '🔄';
      default:
        return '📌';
    }
  };

  const isAdminNote = (event: PPAPEvent) => {
    return getEventDataValue(event.event_data, 'admin_note') === true;
  };

  // Calculate summary metrics
  const totalPPAPs = ppaps.length;
  const activePPAPsCount = ppaps.filter(p => p.workflow_phase !== 'COMPLETE').length;
  const completedPPAPsCount = ppaps.filter(p => p.workflow_phase === 'COMPLETE').length;
  const needsAttention = filteredPpaps.filter(p => {
    const action = getNextAction(p.workflow_phase, p.status);
    return action.priority === 'urgent' || action.priority === 'warning';
  }).length;

  return (
    <div className="space-y-6">
      {/* Tour Component */}
      <Joyride
        steps={tourSteps}
        run={runTour}
        continuous
        showSkipButton
        callback={handleTourCallback}
        styles={{
          tooltip: {
            borderRadius: '8px',
            padding: '12px',
          },
        }}
        floaterProps={{
          styles: {
            floater: {
              zIndex: 10000,
            },
          },
        }}
      />

      {/* Header with Take a Tour Button */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900">PPAP Operations Dashboard</h1>
        <button
          onClick={() => setRunTour(true)}
          className="px-4 py-2 bg-gray-100 text-gray-700 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-200 transition-colors shadow-sm"
        >
          🎯 Take a Tour
        </button>
      </div>

      {/* Summary Metrics */}
      <div data-tour="dashboard-summary" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-white to-gray-50 border-2 border-gray-300 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
            Total PPAPs
          </div>
          <div className="text-4xl font-bold text-gray-900">{totalPPAPs}</div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white border-2 border-blue-200 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="text-sm font-bold text-blue-700 uppercase tracking-wide mb-3">
            Active
          </div>
          <div className="text-4xl font-bold text-blue-600">{activePPAPsCount}</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-white border-2 border-green-200 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3">
            Completed
          </div>
          <div className="text-4xl font-bold text-green-600">{completedPPAPsCount}</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-white border-2 border-amber-200 rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
          <div className="text-sm font-bold text-amber-700 uppercase tracking-wide mb-3">
            Needs Attention
          </div>
          <div className="text-4xl font-bold text-amber-600">{needsAttention}</div>
        </div>
      </div>

      {/* Filters */}
      <div data-tour="dashboard-filters" className="bg-white border-2 border-gray-300 rounded-xl shadow-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Filters</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSortMode('default')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortMode === 'default'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Default Sort
            </button>
            <button
              onClick={() => setSortMode('bottleneck')}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                sortMode === 'bottleneck'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🚨 Bottleneck View
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={filterCustomer}
              onChange={(e) => setFilterCustomer(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map(customer => (
                <option key={customer} value={customer}>{customer || ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status || ''}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phase</label>
            <select
              value={filterPhase}
              onChange={(e) => setFilterPhase(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Phases</option>
              {phases.map(phase => (
                <option key={phase} value={phase}>{WORKFLOW_PHASE_LABELS[phase as keyof typeof WORKFLOW_PHASE_LABELS] || phase}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active PPAPs */}
      <div data-tour="active-ppaps" className="bg-white border-2 border-gray-300 rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b-2 border-gray-200">
          Active PPAPs ({activePpaps.length})
        </h2>
        
        {ppaps.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              No PPAPs yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first PPAP to begin tracking your production part approval process
            </p>
            <a
              href="/ppap/new"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              + Create New PPAP
            </a>
          </div>
        ) : activePpaps.length === 0 ? (
          <p className="text-gray-500 text-center py-8 italic">No active PPAPs found</p>
        ) : null}
        
        <div className="space-y-3">
          {activePpaps.map(ppap => {
            const nextAction = getNextAction(ppap.workflow_phase, ppap.status);
            const stagnant = isStagnant(ppap);
            
            return (
            <div
              key={ppap.id}
              className={`p-4 border-2 rounded-lg transition-all ${
                selectedPpapId === ppap.id
                  ? 'border-blue-500 bg-blue-50'
                  : stagnant
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {stagnant && (
                <div className="mb-3 px-3 py-2 bg-orange-100 border border-orange-300 rounded text-sm text-orange-900 font-medium">
                  ⚠️ Stagnation Alert: Assigned but no updates in 7+ days
                </div>
              )}
              
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Link
                      href={`/ppap/${ppap.id}`}
                      className="text-lg font-bold text-blue-600 hover:text-blue-800 hover:underline transition-colors cursor-pointer"
                    >
                      {ppap.ppap_number}
                    </Link>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      {ppap.status}
                    </span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                      {WORKFLOW_PHASE_LABELS[ppap.workflow_phase as keyof typeof WORKFLOW_PHASE_LABELS] || ppap.workflow_phase}
                    </span>
                  </div>
                  
                  {/* Phase Progress Visual */}
                  <div data-tour="phase-progress" className="mb-3 flex items-center gap-2">
                    {WORKFLOW_PHASES.filter(p => p !== 'COMPLETE').map((phase, idx) => {
                      const isActive = phase === ppap.workflow_phase;
                      const currentPhaseIndex = WORKFLOW_PHASES.findIndex(p => p === ppap.workflow_phase);
                      const thisPhaseIndex = WORKFLOW_PHASES.indexOf(phase);
                      const isPast = thisPhaseIndex < currentPhaseIndex && currentPhaseIndex >= 0;
                      
                      return (
                        <div key={phase} className="flex items-center">
                          <div
                            className={`px-2 py-1 text-xs font-semibold rounded ${
                              isActive
                                ? 'bg-blue-600 text-white'
                                : isPast
                                ? 'bg-green-500 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {phase === 'INITIATION' ? 'INIT' : phase === 'DOCUMENTATION' ? 'DOC' : phase}
                          </div>
                          {idx < WORKFLOW_PHASES.filter(p => p !== 'COMPLETE').length - 1 && (
                            <span className="mx-1 text-gray-400">→</span>
                          )}
                        </div>
                      );
                    })}
                    {ppap.workflow_phase === 'COMPLETE' && (
                      <div className="px-2 py-1 text-xs font-semibold rounded bg-green-600 text-white">
                        COMPLETE
                      </div>
                    )}
                  </div>
                  
                  {/* Next Action */}
                  <div data-tour="next-action" className={`mb-3 px-3 py-2 rounded-lg border-2 ${
                    nextAction.priority === 'urgent'
                      ? 'bg-red-50 border-red-300'
                      : nextAction.priority === 'warning'
                      ? 'bg-yellow-50 border-yellow-300'
                      : 'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${getPriorityColor(nextAction.priority)}`}>
                        {nextAction.priority === 'urgent' ? '🚨 URGENT' : nextAction.priority === 'warning' ? '⚠️ ACTION NEEDED' : '📋 NEXT'}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{nextAction.nextAction}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Part:</span>{' '}
                      <span className="font-medium">{ppap.part_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Customer:</span>{' '}
                      <span className="font-medium">{ppap.customer_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Created:</span>{' '}
                      <span className="font-medium">{formatDate(ppap.created_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Assigned:</span>{' '}
                      <span className="font-medium">{ppap.assigned_to || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/ppap/${ppap.id}`}
                    data-tour="continue-work"
                    className="px-4 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-semibold text-center shadow-sm"
                  >
                    Continue Work →
                  </Link>
                  <button
                    onClick={() => setSelectedPpapId(selectedPpapId === ppap.id ? null : ppap.id)}
                    className="px-3 py-2 text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                  >
                    {selectedPpapId === ppap.id ? 'Hide Details' : 'View Details'}
                  </button>
                  
                  {/* Management Controls */}
                  <div data-tour="management-controls" className="pt-3 mt-1 border-t border-gray-200 px-2">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Management</div>
                    <select
                      value={ppap.assigned_to || ''}
                      onChange={(e) => handleAssignment(ppap.id, e.target.value)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
                      title="Management: Reassign ownership"
                    >
                      <option value="">Unassigned</option>
                      <option value="System User">System User</option>
                      <option value="Matt">Matt</option>
                      <option value="Engineer 1">Engineer 1</option>
                      <option value="Engineer 2">Engineer 2</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Event Panel */}
              {selectedPpapId === ppap.id && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Management Notes */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Add Management Note</h4>
                      <textarea
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Enter admin note..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={addingNote || !adminNote.trim()}
                        className="mt-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-400 transition-colors"
                      >
                        {addingNote ? 'Adding...' : '💬 Add Management Note'}
                      </button>
                    </div>

                    {/* Event History */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 mb-3">Recent Activity</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {events.length === 0 && (
                          <p className="text-sm text-gray-500 italic">No events yet</p>
                        )}
                        {events.map(event => (
                          <div
                            key={event.id}
                            className={`p-3 rounded-lg text-sm ${
                              isAdminNote(event)
                                ? 'bg-red-50 border-2 border-red-300'
                                : 'bg-gray-50 border border-gray-200'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="text-lg">{getEventIcon(event.event_type)}</span>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">
                                  {event.event_type.replace(/_/g, ' ')}
                                  {isAdminNote(event) && (
                                    <span className="ml-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded">
                                      MGMT
                                    </span>
                                  )}
                                </div>
                                {getEventDataString(event.event_data, 'note') && (
                                  <p className="text-gray-700 mt-1">{getEventDataString(event.event_data, 'note')}</p>
                                )}
                                {getEventDataString(event.event_data, 'assigned_to') && (
                                  <p className="text-gray-700 mt-1">
                                    Assigned to: <strong>{getEventDataString(event.event_data, 'assigned_to')}</strong>
                                  </p>
                                )}
                                {getEventDataString(event.event_data, 'file_name') && (
                                  <p className="text-gray-700 mt-1">
                                    File: {getEventDataString(event.event_data, 'file_name')}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(event.created_at).toLocaleString()} • {event.actor || 'System'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
          })}
        </div>
      </div>

      {/* Completed PPAPs */}
      <div className="bg-white border-2 border-gray-300 rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-5 pb-3 border-b-2 border-gray-200">
          Completed PPAPs ({completedPpaps.length})
        </h2>
        <div className="space-y-3">
          {completedPpaps.map(ppap => (
            <div
              key={ppap.id}
              className="p-4 border border-gray-200 rounded-lg bg-green-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-bold text-gray-900">{ppap.ppap_number}</h3>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded">
                      COMPLETE
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Part:</span>{' '}
                      <span className="font-medium">{ppap.part_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Customer:</span>{' '}
                      <span className="font-medium">{ppap.customer_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Completed:</span>{' '}
                      <span className="font-medium">{formatDate(ppap.updated_at)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Assigned:</span>{' '}
                      <span className="font-medium">{ppap.assigned_to || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {completedPpaps.length === 0 && (
            <p className="text-gray-500 text-center py-8 italic">No completed PPAPs found</p>
          )}
        </div>
      </div>
    </div>
  );
}
