export type ValidationStatus =
  | 'not_started'
  | 'in_progress'
  | 'complete'
  | 'approved';

export type ValidationCategory = 'pre-ack' | 'post-ack';

export type ValidationType =
  | 'document'
  | 'task'
  | 'approval'
  | 'data';

export interface Validation {
  id: string;
  name: string;
  category: ValidationCategory;
  validation_type: ValidationType;
  required: boolean;
  requires_approval: boolean;

  status: ValidationStatus;

  completed_by?: string;
  completed_at?: Date;

  approved_by?: string;
  approved_at?: Date;

  evidence?: {
    document_ids?: string[];
    task_ids?: string[];
    notes?: string;
  };
}
