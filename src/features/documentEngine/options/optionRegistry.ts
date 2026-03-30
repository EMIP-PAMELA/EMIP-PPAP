/**
 * Centralized Option Registry
 * Phase V2.7A - Single source of truth for dropdown options
 * 
 * Purpose: Eliminate inline option array duplication across templates
 * 
 * Usage:
 * - Templates reference options via optionsKey instead of inline arrays
 * - DocumentEditor resolves options from this registry
 * - Maintains backward compatibility with inline options
 */

export const OPTION_REGISTRY = {
  // Control Plan Options
  characteristics: [
    'Dimensional',
    'Visual',
    'Functional',
    'Material',
    'Performance',
    'Safety'
  ],

  controlMethods: [
    'Visual Inspection',
    'Measurement',
    'Functional Test',
    'Audit',
    'SPC',
    'Automated Check',
    'Manual Check'
  ],

  sampleSizes: [
    '1',
    '3',
    '5',
    '10',
    '20',
    '50',
    '100%'
  ],

  // PFMEA Options
  failureModes: [
    'Incorrect dimension',
    'Missing component',
    'Wrong material',
    'Surface defect',
    'Incomplete operation',
    'Tool wear',
    'Contamination'
  ],

  effects: [
    'Part rejection',
    'Assembly failure',
    'Customer complaint',
    'Safety hazard',
    'Performance degradation',
    'Rework required'
  ],

  // PFMEA Ratings (1-10)
  severityRatings: [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
  ],

  occurrenceRatings: [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
  ],

  detectionRatings: [
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'
  ]
} as const;

export type OptionRegistryKey = keyof typeof OPTION_REGISTRY;
