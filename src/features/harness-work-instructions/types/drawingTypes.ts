/**
 * Harness Work Instruction Generator — Drawing Type Classification
 * Phase HWI.8 — Drawing Ingestion Foundation
 *
 * DrawingType is the discriminator used to route extraction logic.
 * Classifiers score text content and assign one of these types.
 */

export type DrawingType =
  | 'STRUCTURED_TABLE'  // internal drawings with explicit wire/terminal table
  | 'SIMPLE_WIRE'       // single-wire drawings with one length and 1-2 terminals
  | 'CALLOUT'           // ACI/PN callout-style drawings, sparse table content
  | 'HARNESS_LAYOUT'    // full layout drawings with branching geometry
  | 'UNKNOWN';          // insufficient signal to classify
