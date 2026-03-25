/**
 * Phase 3H - Extended type definitions for validation events
 * 
 * These types extend the base database types with validation-specific events.
 * NOTE: These event types need to be added to the EventType enum in database.types.ts
 */

// Extended EventType to include validation events
// Add these to database.types.ts EventType enum:
// | 'VALIDATION_COMPLETED'
// | 'VALIDATION_APPROVED'

export type ExtendedEventType = 
  | 'PPAP_CREATED'
  | 'STATUS_CHANGED'
  | 'ASSIGNED'
  | 'DOCUMENT_UPLOADED'
  | 'COMMENT_ADDED'
  | 'VALIDATION_COMPLETED'  // Phase 3H
  | 'VALIDATION_APPROVED';   // Phase 3H
