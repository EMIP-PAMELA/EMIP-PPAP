import type { DocumentType } from '@/src/features/harness-work-instructions/services/skuService';

export type VaultDocumentClassification = {
  detected: DocumentType | 'UNKNOWN';
  signals: string[];
};

function normalizeTextPreview(text: string, limit = 2000): string {
  return text.slice(0, limit).toUpperCase();
}

export function detectDocumentType(extractedText: string, fileName: string): VaultDocumentClassification {
  const text = normalizeTextPreview(extractedText);
  const signals: string[] = [];

  const bomIndicators = [/BILL OF MATERIAL/i, /BOM/i, /ITEM\s+NO\.?/i, /QTY/i, /COMPONENT\s+PART/i];
  const hasBOMSignal = bomIndicators.some(pattern => {
    const match = pattern.test(text);
    if (match) signals.push(`BOM:${pattern}`);
    return match;
  });
  if (hasBOMSignal || /BOM/i.test(fileName)) {
    return { detected: 'BOM', signals };
  }

  const internalIndicators = [/INTERNAL DRAWING/i, /DWG NO\.?/i, /DRAWING NUMBER/i, /MANUFACTURING DRAWING/i, /ENGINEERING DRAWING/i];
  const customerIndicators = [/CUSTOMER DRAWING/i, /CUSTOMER PART/i, /SUPPLIER DRAWING/i];

  const hasInternal = internalIndicators.some(pattern => {
    const match = pattern.test(text);
    if (match) signals.push(`INTERNAL:${pattern}`);
    return match;
  });

  const hasCustomer = customerIndicators.some(pattern => {
    const match = pattern.test(text);
    if (match) signals.push(`CUSTOMER:${pattern}`);
    return match;
  });

  if (hasInternal && !hasCustomer) {
    return { detected: 'INTERNAL_DRAWING', signals };
  }

  if (hasCustomer || /DRW/i.test(fileName) || /DWG/i.test(fileName)) {
    return { detected: 'CUSTOMER_DRAWING', signals };
  }

  signals.push('FALLBACK:CUSTOMER_DRAWING');
  return { detected: 'UNKNOWN', signals };
}

export function materializeDocumentType(classification: DocumentType | 'UNKNOWN'): DocumentType {
  if (classification === 'BOM') return 'BOM';
  if (classification === 'INTERNAL_DRAWING') return 'INTERNAL_DRAWING';
  if (classification === 'CUSTOMER_DRAWING') return 'CUSTOMER_DRAWING';
  return 'UNKNOWN';
}
