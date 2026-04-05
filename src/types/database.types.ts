export type PPAPStatus =
  | 'NEW'
  | 'INTAKE_COMPLETE'
  | 'PRE_ACK_ASSIGNED'
  | 'PRE_ACK_IN_PROGRESS'
  | 'READY_TO_ACKNOWLEDGE'
  | 'ACKNOWLEDGED'
  | 'POST_ACK_ASSIGNED'
  | 'POST_ACK_IN_PROGRESS'
  | 'AWAITING_SUBMISSION'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'ON_HOLD'
  | 'BLOCKED'
  | 'CLOSED';

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';

export type TaskPhase =
  | 'PRE_ACK'
  | 'POST_ACK'
  | 'SUBMISSION'
  | 'OTHER';

export type DocumentType =
  | 'DRAWING'
  | 'SPECIFICATION'
  | 'CONTROL_PLAN'
  | 'PROCESS_FLOW'
  | 'FMEA'
  | 'MSA'
  | 'CAPABILITY_STUDY'
  | 'APPEARANCE_APPROVAL'
  | 'SAMPLE_PRODUCT'
  | 'MASTER_SAMPLE'
  | 'CHECKING_AIDS'
  | 'CUSTOMER_SPECIFIC'
  | 'OTHER';

export type MessageType =
  | 'NOTE'
  | 'QUESTION'
  | 'ANSWER'
  | 'BLOCKER'
  | 'RESOLUTION'
  | 'HANDOFF'
  | 'STATUS_UPDATE';

export type EventType =
  | 'PPAP_CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'DOCUMENT_ADDED'
  | 'DOCUMENT_REMOVED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_DELETED'
  | 'CONVERSATION_ADDED'
  | 'MOLD_STATUS_CHANGED'
  | 'RISK_FLAGGED'
  | 'RISK_CLEARED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'BLOCKED'
  | 'UNBLOCKED'
  | 'PHASE_ADVANCED'
  | 'DOCUMENTATION_SUBMITTED'
  | 'SAMPLE_SUBMITTED'
  | 'REVIEW_COMPLETED'
  | 'PPAP_DELETED';

export type MoldStatus =
  | 'NOT_STARTED'
  | 'DESIGN_IN_PROGRESS'
  | 'DESIGN_APPROVED'
  | 'FABRICATION_IN_PROGRESS'
  | 'FIRST_ARTICLE_COMPLETE'
  | 'VALIDATION_IN_PROGRESS'
  | 'VALIDATED'
  | 'BLOCKED';

export type PPAPType =
  | 'NPI'
  | 'CHANGE'
  | 'MAINTENANCE';

export interface PPAPRecord {
  id: string;
  ppap_number: string;
  part_number: string;
  customer_name: string;
  plant: string;
  request_date: string;
  ppap_type?: PPAPType | null;
  status: PPAPStatus;
  workflow_phase: string;
  department: string; // V3.3A.5: Department queue assignment
  assigned_to?: string | null; // V3.3A.5: Individual owner (null = unclaimed)
  assigned_role?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PPAPDocument {
  id: string;
  ppap_id: string;
  file_name: string | null;
  category: string | null;
  file_url: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface PPAPConversation {
  id: string;
  ppap_id: string;
  body: string;
  message_type: MessageType;
  author: string;
  site: string | null;
  created_at: string;
}

export interface PPAPTask {
  id: string;
  ppap_id: string;
  phase: string | null;
  title: string | null;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface PPAPEvent {
  id: string;
  ppap_id: string;
  event_type: EventType;
  event_data: Record<string, unknown> | null;
  actor: string;
  actor_role: string | null;
  created_at: string;
}

export interface CreatePPAPInput {
  ppap_number: string;
  part_number: string;
  customer_name: string;
  plant?: string;
  request_date: string;
  ppap_type: PPAPType;
  department: string; // V3.3A.5: Required department for queue assignment
}

export interface UpdatePPAPInput {
  status?: PPAPStatus;
  assigned_to?: string;
  assigned_role?: string;
  acknowledged_date?: string;
  submitted_date?: string;
  approved_date?: string;
  mold_status?: MoldStatus;
  mold_supplier?: string;
  mold_lead_time_days?: number;
  risk_flags?: string[];
}

export interface CreateTaskInput {
  ppap_id: string;
  title: string;
  phase?: string;
  assigned_to?: string;
  due_date?: string;
}

export interface CreateConversationInput {
  ppap_id: string;
  message: string;
  message_type?: MessageType;
  author: string;
  site?: string;
}

export interface CreateDocumentInput {
  ppap_id: string;
  file_name: string;
  category?: string;
  file_url?: string;
  uploaded_by: string;
}

export interface CreateEventInput {
  ppap_id: string;
  event_type: EventType;
  event_data?: Record<string, unknown>;
  actor: string;
  actor_role?: string;
}
