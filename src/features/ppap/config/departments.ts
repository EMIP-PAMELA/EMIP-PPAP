/**
 * V3.3A.5: Department Configuration
 * 
 * Defines valid departments for PPAP queue assignment.
 * PPAPs are assigned to departments at creation and appear in department queues
 * until claimed by an individual owner.
 */

export const VALID_DEPARTMENTS = [
  'Engineering',
  'Quality',
  'Manufacturing',
  'Supply Chain',
  'Product Development',
] as const;

export type Department = typeof VALID_DEPARTMENTS[number];

export const DEPARTMENT_LABELS: Record<string, string> = {
  'Engineering': 'Engineering',
  'Quality': 'Quality Assurance',
  'Manufacturing': 'Manufacturing',
  'Supply Chain': 'Supply Chain / Procurement',
  'Product Development': 'Product Development',
};

export const DEPARTMENT_DESCRIPTIONS: Record<string, string> = {
  'Engineering': 'Design, validation, and technical documentation',
  'Quality': 'Quality control, inspection, and compliance',
  'Manufacturing': 'Production planning and process engineering',
  'Supply Chain': 'Supplier management and procurement',
  'Product Development': 'New product introduction and R&D',
};
