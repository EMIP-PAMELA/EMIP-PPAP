/**
 * DOCUMENT PRESENCE CONTRACT
 *
 * This is the ONLY approved method of determining document state.
 * All UI and pipeline logic must depend on this layer.
 *
 * Upstream dependency: docByType
 * Downstream consumers: SKU page, pipeline, readiness
 *
 * Any mismatch between this and actual documents indicates a system defect.
 */
import type { SKUDocumentRecord } from '@/src/features/harness-work-instructions/services/skuService';

export type SupportedDocumentType = 'BOM' | 'CUSTOMER_DRAWING' | 'INTERNAL_DRAWING';

export type DocumentPresence = {
  hasBOM: boolean;
  hasCustomerDrawing: boolean;
  hasInternalDrawing: boolean;
  hasAnyDrawing: boolean;
};

export type DocByTypeMap = Record<SupportedDocumentType, SKUDocumentRecord | null>;

export function deriveDocumentPresence(docByType: DocByTypeMap): DocumentPresence {
  const hasBOM = Boolean(docByType.BOM);
  const hasCustomerDrawing = Boolean(docByType.CUSTOMER_DRAWING);
  const hasInternalDrawing = Boolean(docByType.INTERNAL_DRAWING);

  return {
    hasBOM,
    hasCustomerDrawing,
    hasInternalDrawing,
    hasAnyDrawing: hasCustomerDrawing || hasInternalDrawing,
  };
}
