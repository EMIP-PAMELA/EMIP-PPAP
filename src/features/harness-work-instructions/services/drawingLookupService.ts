import { DRAWING_LOOKUP } from '@/src/core/data/drawingLookup';

export function resolvePartNumberFromDrawing(drawingNumber: string): string | null {
  const normalized = drawingNumber.trim().toUpperCase();

  if (DRAWING_LOOKUP[normalized]) {
    console.log('[HWI DRAWING LOOKUP HIT]', normalized);
    return DRAWING_LOOKUP[normalized];
  }

  console.log('[HWI DRAWING LOOKUP MISS]', normalized);
  return null;
}
