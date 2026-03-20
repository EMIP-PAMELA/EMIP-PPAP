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
  | 'TASK_COMPLETED'
  | 'CONVERSATION_ADDED'
  | 'MOLD_STATUS_CHANGED'
  | 'RISK_FLAGGED'
  | 'RISK_CLEARED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'BLOCKED'
  | 'UNBLOCKED';

export type MoldStatus =
  | 'NOT_STARTED'
  | 'DESIGN_IN_PROGRESS'
  | 'DESIGN_APPROVED'
  | 'FABRICATION_IN_PROGRESS'
  | 'FIRST_ARTICLE_COMPLETE'
  | 'VALIDATION_IN_PROGRESS'
  | 'VALIDATED'
  | 'BLOCKED';

export interface PPAPRecord {
  id: string;
  ppap_number: string;
  part_number: string;
  customer_name: string;
  plant: string;
  status: PPAPStatus;
  request_date: string;
  created_at: string;
  updated_at: string;
}

export interface PPAPDocument {
  id: string;
  ppap_id: string;
  document_name: string;
  document_type: DocumentType | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  storage_path: string | null;
  storage_bucket: string | null;
  uploaded_by: string;
  version: number;
  notes: string | null;
}

export interface PPAPConversation {
  id: string;
  ppap_id: string;
  message: string;
  message_type: MessageType;
  author: string;
  author_site: string | null;
  created_at: string;
  edited_at: string | null;
}

export interface PPAPTask {
  id: string;
  ppap_id: string;
  title: string;
  description: string | null;
  task_type: string | null;
  phase: TaskPhase | null;
  assigned_to: string | null;
  assigned_role: string | null;
  status: TaskStatus;
  priority: string;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  updated_at: string;
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
  part_number: string;
  customer_name: string;
  plant: string;
  request_date: string;
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
  description?: string;
  task_type?: string;
  phase: TaskPhase;
  assigned_to?: string;
  assigned_role?: string;
  due_date?: string;
  priority?: string;
}

export interface CreateConversationInput {
  ppap_id: string;
  message: string;
  message_type?: MessageType;
  author: string;
  author_site?: string;
}

export interface CreateDocumentInput {
  ppap_id: string;
  document_name: string;
  document_type: DocumentType;
  file_size_bytes?: number;
  mime_type?: string;
  storage_path?: string;
  storage_bucket?: string;
  uploaded_by: string;
  notes?: string;
}

export interface CreateEventInput {
  ppap_id: string;
  event_type: EventType;
  event_data?: Record<string, unknown>;
  actor: string;
  actor_role?: string;
}
