'use client';

import { useState } from 'react';
import { PPAPRecord } from '@/src/types/database.types';
import { formatDate } from '@/src/lib/utils';
import Link from 'next/link';
import { StatusUpdateControl } from './StatusUpdateControl';
import { getNextAction, getPriorityColor, getPriorityBackground } from '../utils/getNextAction';
import { mapStatusToPhase } from '../utils/stateWorkflowMapping';
import { supabase } from '@/src/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { logEvent } from '@/src/features/events/mutations';
import { deriveCustomerType } from '../utils/ppapTableHelpers';

interface PPAPHeaderProps {
  ppap: PPAPRecord;
}

export function PPAPHeader({ ppap }: PPAPHeaderProps) {
  const router = useRouter();
  const [assignedTo, setAssignedTo] = useState(ppap.assigned_to || null);
  const [takingOwnership, setTakingOwnership] = useState(false);
  
  // V3.3A.5: Current user (in production, get from auth context)
  const currentUser = 'System User';
  const isOwner = assignedTo === currentUser;
  const isUnclaimed = !assignedTo;
  
  // Phase sync fix: Derive phase from status (single source of truth)
  const derivedPhase = mapStatusToPhase(ppap.status);
  const nextActionData = getNextAction(derivedPhase, ppap.status);
  const customerType = deriveCustomerType(ppap.customer_name);
  
  // Debug logging for phase sync
  console.log('🧭 PHASE SYNC CHECK', {
    status: ppap.status,
    derivedPhase,
    nextAction: nextActionData.nextAction,
  });
  
  const handleTakeOwnership = async () => {
    setTakingOwnership(true);
    try {
      // V3.3A.5: Claim ownership from department queue
      await supabase
        .from('ppap_records')
        .update({ 
          assigned_to: currentUser,
          status: 'POST_ACK_IN_PROGRESS', // V3.3A.5: Set to in-progress when claimed
          updated_at: new Date().toISOString(),
        })
        .eq('id', ppap.id);
      
      // Log ownership claim event
      await logEvent({
        ppap_id: ppap.id,
        event_type: 'ASSIGNED',
        event_data: {
          assigned_to: currentUser,
          department: ppap.department,
          claimed_from_queue: true,
        },
        actor: currentUser,
        actor_role: 'Engineer',
      });
      
      setAssignedTo(currentUser);
      router.refresh();
    } catch (error) {
      console.error('Failed to take ownership:', error);
    } finally {
      setTakingOwnership(false);
    }
  };
  
  // V3.3A.14: Reduce visual aggression - use informational tones
  const getBannerColor = () => {
    switch (nextActionData.priority) {
      case 'urgent':
        return 'bg-red-50 border-red-300 text-red-900';
      case 'warning':
        return 'bg-blue-50 border-blue-200 text-blue-900'; // Changed from yellow to blue
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  return (
    <div className="bg-white border border-gray-300 rounded-xl shadow-sm">
      {/* Phase sync fix: Banner derived from ppap.status */}
      <div className={`px-6 py-4 border-b-2 ${getBannerColor()}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl">📍</span>
          <div className="flex-1">
            <p className="text-sm font-bold uppercase tracking-wide">You Are Here — {derivedPhase} Phase</p>
            <p className="text-base font-semibold">
              {nextActionData.nextAction || ''}
            </p>
          </div>
          {/* Phase 3H.12/3H.13.5: Phase vs Status clarity with interpretation */}
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Current Phase</div>
            <div className="text-sm font-semibold text-gray-700">{derivedPhase}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mt-1">Status</div>
            <div className="text-sm font-semibold text-gray-700">
              {ppap.status === 'READY_TO_ACKNOWLEDGE' ? 'Validation Pending' : ppap.status.replace(/_/g, ' ')}
            </div>
            {/* V3.3A.14: Non-blocking status guidance */}
            <div className="text-xs text-gray-600 mt-2 italic max-w-xs">
              {ppap.status === 'READY_TO_ACKNOWLEDGE' && 'Pre-build validation pending (Coordinator review required before release)'}
              {ppap.status === 'POST_ACK_IN_PROGRESS' && 'Work actively ongoing'}
              {ppap.status === 'AWAITING_SUBMISSION' && 'Ready for submission to customer'}
              {ppap.status === 'SUBMITTED' && 'Under customer review'}
              {ppap.status === 'APPROVED' && 'Process complete'}
              {ppap.status === 'PRE_ACK_IN_PROGRESS' && 'Pre-acknowledgement validations in progress'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 border-b border-gray-200">
        {/* V3.3A.12: Breadcrumb Navigation */}
        <div className="flex items-center text-sm font-medium mb-4">
          <Link
            href="/ppap"
            className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
          >
            ← Dashboard
          </Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-700 font-semibold">
            {ppap.ppap_number}
          </span>
        </div>

        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-3">
              <h1 className="text-4xl font-bold text-gray-900">{ppap.ppap_number}</h1>
              <StatusUpdateControl ppapId={ppap.id} currentStatus={ppap.status} />
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-sm font-medium text-gray-600">Part Number:</span>
              <p className="text-xl font-semibold text-gray-900">{ppap.part_number}</p>
            </div>
          </div>
          {/* V3.3A.5: Department Queue + Ownership Display */}
          <div className="flex items-center gap-3">
            {/* Department Queue Badge */}
            <div className="px-4 py-2 bg-purple-50 border border-purple-200 rounded-lg">
              <span className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Department</span>
              <p className="text-sm font-medium text-purple-900">{ppap.department}</p>
            </div>
            
            {/* Ownership Status */}
            {isUnclaimed && (
              <button
                onClick={handleTakeOwnership}
                disabled={takingOwnership}
                className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {takingOwnership ? 'Claiming...' : '✋ Claim Ownership'}
              </button>
            )}
            {assignedTo && (
              <div className={`px-4 py-2 border rounded-lg ${
                isOwner 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <span className={`text-xs font-semibold uppercase tracking-wide ${
                  isOwner ? 'text-blue-700' : 'text-yellow-700'
                }`}>
                  {isOwner ? 'You Own This' : 'Owner'}
                </span>
                <p className={`text-sm font-medium ${
                  isOwner ? 'text-blue-900' : 'text-yellow-900'
                }`}>
                  {assignedTo}
                </p>
              </div>
            )}
            
            {/* Read-Only Warning */}
            {assignedTo && !isOwner && (
              <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg">
                <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">🔒 Read-Only</span>
                <p className="text-xs text-red-900">Only owner can edit</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">PPAP Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Customer</h4>
            <p className="text-base font-semibold text-gray-900">{ppap.customer_name}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Template</h4>
            <p className={`text-base font-semibold ${
              customerType === 'TRANE' ? 'text-blue-600' : 'text-green-600'
            }`}>
              {customerType === 'TRANE' ? '🔵 Trane PPAP Workflow' : '🟢 Rheem PPAP Workflow'}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Plant</h4>
            <p className="text-base font-semibold text-gray-900">{ppap.plant}</p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Request Date</h4>
            <p className="text-base font-semibold text-gray-900">
              {formatDate(ppap.request_date)}
            </p>
          </div>

          <div>
            <h4 className="text-xs font-medium text-gray-600 mb-2 uppercase tracking-wide">Created</h4>
            <p className="text-base font-semibold text-gray-900">
              {formatDate(ppap.created_at)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
