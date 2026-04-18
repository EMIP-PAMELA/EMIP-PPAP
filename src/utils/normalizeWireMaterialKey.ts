export interface WireMaterialShape {
  gauge?: string | number | null;
  color?: string | null;
  type?: string | null;
}

function toUpper(value?: string | number | null): string {
  if (value === null || value === undefined) return 'UNKNOWN';
  const str = typeof value === 'number' ? value.toString() : String(value);
  const trimmed = str.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : 'UNKNOWN';
}

export function normalizeWireMaterialKey(shape: WireMaterialShape): string {
  const gauge = toUpper(shape.gauge);
  const color = toUpper(shape.color);
  const type = toUpper(shape.type);
  return [gauge, color, type].join('|');
}
