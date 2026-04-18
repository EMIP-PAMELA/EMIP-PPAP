export function normalizeToInches(value: number | string | null | undefined, unit?: string | null): number {
  if (value === null || value === undefined) return 0;
  const numeric = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(numeric)) return 0;

  const normalizedUnit = (unit ?? 'in').toString().trim().toLowerCase();
  if (normalizedUnit === 'ft' || normalizedUnit === 'feet' || normalizedUnit === 'foot') {
    return numeric * 12;
  }
  if (normalizedUnit === 'mm' || normalizedUnit === 'millimeter' || normalizedUnit === 'millimeters') {
    return numeric * 0.0393701;
  }
  return numeric;
}
