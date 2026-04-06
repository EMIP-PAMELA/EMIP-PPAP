/**
 * V3.3A.8: Activity Service
 * 
 * Manages PPAP activity feed - combines system events and user posts.
 */

import { supabase } from '@/src/lib/supabaseClient';
import { getEventsByPPAPId } from '@/src/features/events/mutations';
import { Activity, CreateActivityInput, eventToActivity } from '../types/activity';

/**
 * Get all activities for a PPAP (system events + user posts)
 */
export async function getActivities(ppapId: string): Promise<Activity[]> {
  // Get system events
  const events = await getEventsByPPAPId(ppapId);
  const systemActivities = events.map(eventToActivity);
  
  // V3.4 Phase 5: Temporarily disabled - ppap_activities table not yet created
  // Get user-posted activities
  // const { data: userActivities, error } = await supabase
  //   .from('ppap_activities')
  //   .select('*')
  //   .eq('ppap_id', ppapId)
  //   .order('created_at', { ascending: false });
  const userActivities: any[] = [];
  const error = null;
  
  // Error handling disabled while table doesn't exist
  // if (error && error.code !== 'PGRST116') {
  //   console.warn('Failed to fetch user activities:', error);
  // }
  
  const userActivityList: Activity[] = (userActivities || []).map((a: any) => ({
    id: a.id,
    ppapId: a.ppap_id,
    type: a.activity_type,
    priority: a.priority || 'normal',
    message: a.message,
    userId: a.user_id,
    userName: a.user_name,
    userRole: a.user_role,
    metadata: a.metadata,
    createdAt: a.created_at,
  }));
  
  // Combine and sort by timestamp (newest first)
  const allActivities = [...systemActivities, ...userActivityList];
  allActivities.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  
  return allActivities;
}

/**
 * Create a user-posted activity
 */
export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  // V3.4 Phase 5: Temporarily disabled - ppap_activities table not yet created
  throw new Error('ppap_activities table not yet created - createActivity disabled');
  
  // const { data, error } = await supabase
  //   .from('ppap_activities')
  //   .insert({
  //     ppap_id: input.ppapId,
  //     activity_type: input.type,
  //     priority: input.priority || 'normal',
  //     message: input.message,
  //     user_id: input.userId || null,
  //     user_name: input.userName || null,
  //     user_role: input.userRole || null,
  //     metadata: input.metadata || null,
  //   })
  //   .select()
  //   .single();
  // 
  // if (error) {
  //   console.error('Failed to create activity:', error);
  //   throw error;
  // }
  // 
  // if (!data) {
  //   throw new Error('Failed to create activity: no data returned');
  // }
  // 
  // return {
  //   id: data.id,
  //   ppapId: data.ppap_id,
  //   type: data.activity_type,
  //   priority: data.priority,
  //   message: data.message,
  //   userId: data.user_id,
  //   userName: data.user_name,
  //   userRole: data.user_role,
  //   metadata: data.metadata,
  //   createdAt: data.created_at,
  // };
}

/**
 * Get count of open issues for a PPAP
 */
export async function getIssueCount(ppapId: string): Promise<number> {
  // V3.4 Phase 5: Temporarily disabled - ppap_activities table not yet created
  // const { data, error } = await supabase
  //   .from('ppap_activities')
  //   .select('id', { count: 'exact', head: true })
  //   .eq('ppap_id', ppapId)
  //   .in('priority', ['issue', 'risk']);
  const error = null;
  
  // Error handling disabled while table doesn't exist
  // if (error && error.code !== 'PGRST116') {
  //   console.warn('Failed to count issues:', error);
  //   return 0;
  // }
  
  return 0; // Return 0 while table doesn't exist
}
