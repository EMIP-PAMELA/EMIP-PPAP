/**
 * Phase 27: Cross-PPAP Dashboard and System Visibility Layer
 * 
 * Service for aggregating system-wide data for dashboard view.
 * READ-ONLY operations only.
 */

import { supabase } from '@/src/lib/supabaseClient';
import { PPAPUser } from '../auth/userService';
import { DocumentStatus, DocumentMetadata } from '../documentEngine/persistence/sessionService';
import { TemplateId } from '../documentEngine/templates/types';

export type DashboardSession = {
  id: string;
  name: string;
  ppapId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  totalDocuments: number;
  approvedDocuments: number;
  inReviewDocuments: number;
  draftDocuments: number;
  documentsWithErrors: number;
  documentStatuses: Record<TemplateId, DocumentStatus | null>;
};

export type DashboardStats = {
  totalSessions: number;
  totalDocuments: number;
  approvedDocuments: number;
  pendingApprovals: number;
  documentsWithErrors: number;
};

/**
 * Get all sessions with aggregated document statistics
 */
export async function getAllSessionsWithStats(): Promise<DashboardSession[]> {
  try {
    const { data: sessions, error } = await supabase
      .from('ppap_document_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[DashboardService] Failed to get sessions:', error);
      return [];
    }

    if (!sessions) return [];

    // Get user names for session owners
    const userIds = sessions
      .map(s => s.created_by)
      .filter((id): id is string => id !== null);
    
    const uniqueUserIds = [...new Set(userIds)];
    
    const { data: users } = await supabase
      .from('ppap_users')
      .select('id, name')
      .in('id', uniqueUserIds);

    const userMap = new Map(users?.map(u => [u.id, u.name]) || []);

    // Process each session to extract document stats
    const dashboardSessions: DashboardSession[] = sessions.map(session => {
      const sessionData = session.data as any;
      const documents = sessionData?.documents || {};
      const documentMeta = sessionData?.documentMeta || {};
      const validationResults = sessionData?.validationResults || {};

      const documentKeys = Object.keys(documents) as TemplateId[];
      
      let approved = 0;
      let inReview = 0;
      let draft = 0;
      let withErrors = 0;

      const documentStatuses: Record<string, DocumentStatus | null> = {
        PROCESS_FLOW: null,
        PFMEA: null,
        CONTROL_PLAN: null,
        PSW: null,
      };

      documentKeys.forEach(key => {
        const meta = documentMeta[key] as DocumentMetadata | undefined;
        const validation = validationResults[key];

        if (meta) {
          documentStatuses[key] = meta.status;
          
          if (meta.status === 'approved') approved++;
          else if (meta.status === 'in_review') inReview++;
          else if (meta.status === 'draft') draft++;
        }

        if (validation && !validation.isValid) {
          withErrors++;
        }
      });

      return {
        id: session.id,
        name: session.name,
        ppapId: session.ppap_id,
        createdBy: session.created_by,
        createdByName: session.created_by ? userMap.get(session.created_by) || 'Unknown' : null,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        totalDocuments: documentKeys.length,
        approvedDocuments: approved,
        inReviewDocuments: inReview,
        draftDocuments: draft,
        documentsWithErrors: withErrors,
        documentStatuses,
      };
    });

    return dashboardSessions;
  } catch (err) {
    console.error('[DashboardService] Unexpected error getting sessions:', err);
    return [];
  }
}

/**
 * Get aggregated system-wide statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const sessions = await getAllSessionsWithStats();

  const stats: DashboardStats = {
    totalSessions: sessions.length,
    totalDocuments: 0,
    approvedDocuments: 0,
    pendingApprovals: 0,
    documentsWithErrors: 0,
  };

  sessions.forEach(session => {
    stats.totalDocuments += session.totalDocuments;
    stats.approvedDocuments += session.approvedDocuments;
    stats.pendingApprovals += session.inReviewDocuments;
    stats.documentsWithErrors += session.documentsWithErrors;
  });

  return stats;
}

/**
 * Filter sessions by user
 */
export function filterSessionsByUser(
  sessions: DashboardSession[],
  userId: string | null
): DashboardSession[] {
  if (!userId) return sessions;
  return sessions.filter(s => s.createdBy === userId);
}

/**
 * Filter sessions by status
 */
export function filterSessionsByStatus(
  sessions: DashboardSession[],
  status: 'all' | 'has-approved' | 'has-pending' | 'has-errors'
): DashboardSession[] {
  if (status === 'all') return sessions;
  
  if (status === 'has-approved') {
    return sessions.filter(s => s.approvedDocuments > 0);
  }
  
  if (status === 'has-pending') {
    return sessions.filter(s => s.inReviewDocuments > 0);
  }
  
  if (status === 'has-errors') {
    return sessions.filter(s => s.documentsWithErrors > 0);
  }
  
  return sessions;
}

/**
 * Get bottleneck sessions (stuck in review or with errors)
 */
export function getBottleneckSessions(sessions: DashboardSession[]): DashboardSession[] {
  return sessions.filter(s => 
    s.inReviewDocuments > 0 || 
    s.documentsWithErrors > 0
  );
}
