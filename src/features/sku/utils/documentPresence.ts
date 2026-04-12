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
