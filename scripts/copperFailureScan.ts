type BOMRecord = import('@/src/core/data/bom/types').BOMRecord;
const bomService = require('@/src/core/services/bomService');
const wireDetection = require('@/src/core/utils/wireDetection');
const { getAllActiveBOMs, getBOM, computeSKUInsights, normalizeComponentForAnalytics } = bomService;
const { looksLikeWirePart } = wireDetection;

type NormalizedComponent = ReturnType<typeof normalizeComponentForAnalytics>;

interface DiagnosticEntry {
  partNumber: string;
  totalComponents: number;
  wireRecordsCount: number;
  canonicalWireCount: number;
  recoveredWireCount: number;
  unknownCategoryCount: number;
  wiresMissingGaugeCount: number;
  lengthSourceModes: {
    qtyPerMode: number;
    cutLengthMode: number;
  };
  copperResult: {
    isComplete: boolean;
    estimatedCopperWeight: number | null;
  };
  reason: FailureReason;
}

type FailureReason =
  | 'VALID'
  | 'NO_WIRES_DETECTED'
  | 'MISSING_GAUGE'
  | 'CLASSIFICATION_WEAK'
  | 'HEAVY_RECOVERY_DEPENDENCE';

const FAILURE_REASONS: Exclude<FailureReason, 'VALID'>[] = [
  'NO_WIRES_DETECTED',
  'MISSING_GAUGE',
  'CLASSIFICATION_WEAK',
  'HEAVY_RECOVERY_DEPENDENCE'
];

const CLASSIFICATION_WEAK_THRESHOLD = 0.5;

function determineLengthMode(record: BOMRecord): 'QTY_PER_MODE' | 'CUT_LENGTH_MODE' {
  const qtyPer = Number(record.quantity) || 0;
  const cutLength = Number(record.length) || 0;
  if (qtyPer <= 1 && cutLength > 1) {
    return 'CUT_LENGTH_MODE';
  }
  return 'QTY_PER_MODE';
}

async function runCopperFailureScan() {
  const activeBOMs = await getAllActiveBOMs();
  const diagnostics: DiagnosticEntry[] = [];

  for (const bom of activeBOMs) {
    const partNumber = bom.partNumber;
    const records = await getBOM(partNumber);
    const normalized: NormalizedComponent[] = records.map(normalizeComponentForAnalytics);

    const canonicalWireRecords = normalized.filter(
      (record: NormalizedComponent) => record.category === 'WIRE' && record.effectiveLength > 0
    );

    const recoveredWireRecords = normalized.filter(
      (record: NormalizedComponent) =>
        record.category !== 'WIRE' &&
        record.effectiveLength > 0 &&
        looksLikeWirePart(record.component_part_number)
    );

    const wireRecords: NormalizedComponent[] = [...canonicalWireRecords, ...recoveredWireRecords];

    const wiresMissingGaugeCount = wireRecords.filter((record: NormalizedComponent) => !record.gauge).length;
    const unknownCategoryCount = normalized.filter(
      (record: NormalizedComponent) => !record.category || record.category === 'UNKNOWN'
    ).length;

    const lengthModes = records.reduce(
      (acc: { qtyPerMode: number; cutLengthMode: number }, record: BOMRecord) => {
        const isCanonicalWire = record.category === 'WIRE';
        const isRecoveredWire = !isCanonicalWire && looksLikeWirePart(record.component_part_number);
        if (!isCanonicalWire && !isRecoveredWire) {
          return acc;
        }

        const mode = determineLengthMode(record);
        if (mode === 'CUT_LENGTH_MODE') {
          acc.cutLengthMode += 1;
        } else {
          acc.qtyPerMode += 1;
        }
        return acc;
      },
      { qtyPerMode: 0, cutLengthMode: 0 }
    );

    const insights = computeSKUInsights(records);

    const reason = classifyFailureReason({
      wireRecordsCount: wireRecords.length,
      wiresMissingGaugeCount,
      totalComponents: records.length,
      unknownCategoryCount,
      canonicalWireCount: canonicalWireRecords.length,
      recoveredWireCount: recoveredWireRecords.length
    });

    diagnostics.push({
      partNumber,
      totalComponents: records.length,
      wireRecordsCount: wireRecords.length,
      canonicalWireCount: canonicalWireRecords.length,
      recoveredWireCount: recoveredWireRecords.length,
      unknownCategoryCount,
      wiresMissingGaugeCount,
      lengthSourceModes: lengthModes,
      copperResult: {
        isComplete: insights.isComplete,
        estimatedCopperWeight: insights.estimatedCopperWeight
      },
      reason
    });
  }

  const breakdown = diagnostics.reduce(
    (acc, entry) => {
      if (entry.reason !== 'VALID') {
        acc[entry.reason] = (acc[entry.reason] || 0) + 1;
      }
      return acc;
    },
    {} as Record<Exclude<FailureReason, 'VALID'>, number>
  );

  const totalBOMs = diagnostics.length;
  const failedCount = diagnostics.filter((entry) => entry.reason !== 'VALID').length;
  const validCount = totalBOMs - failedCount;

  const failuresByReason = Object.fromEntries(
    FAILURE_REASONS.map((reason) => [
      reason,
      diagnostics
        .filter((entry) => entry.reason === reason)
        .sort((a, b) => b.wireRecordsCount - a.wireRecordsCount)
        .slice(0, 10)
        .map((entry) => ({
          partNumber: entry.partNumber,
          reason: entry.reason,
          wireRecordsCount: entry.wireRecordsCount,
          recoveredWireCount: entry.recoveredWireCount,
          wiresMissingGaugeCount: entry.wiresMissingGaugeCount,
          estimatedCopperWeight: entry.copperResult.estimatedCopperWeight
        }))
    ])
  );

  const recommendation = deriveRecommendation(breakdown, failedCount);

  const output = {
    summary: {
      totalBOMs,
      validCount,
      failedCount,
      breakdown
    },
    failures: failuresByReason,
    recommendation,
    timestamp: new Date().toISOString()
  };

  console.log(JSON.stringify(output, null, 2));
}

function classifyFailureReason(params: {
  wireRecordsCount: number;
  wiresMissingGaugeCount: number;
  totalComponents: number;
  unknownCategoryCount: number;
  canonicalWireCount: number;
  recoveredWireCount: number;
}): FailureReason {
  if (params.wireRecordsCount === 0) {
    return 'NO_WIRES_DETECTED';
  }

  if (params.wiresMissingGaugeCount > 0) {
    return 'MISSING_GAUGE';
  }

  const unknownRatio = params.totalComponents === 0
    ? 0
    : params.unknownCategoryCount / params.totalComponents;

  if (unknownRatio > CLASSIFICATION_WEAK_THRESHOLD) {
    return 'CLASSIFICATION_WEAK';
  }

  if (params.recoveredWireCount > params.canonicalWireCount) {
    return 'HEAVY_RECOVERY_DEPENDENCE';
  }

  return 'VALID';
}

function deriveRecommendation(
  breakdown: Record<Exclude<FailureReason, 'VALID'>, number>,
  failedCount: number
): string {
  if (failedCount === 0) {
    return 'All BOMs valid — no action required';
  }

  const reasonEntries = Object.entries(breakdown) as [FailureReason, number][];
  reasonEntries.sort((a, b) => b[1] - a[1]);
  const [topReason] = reasonEntries[0] || ['VALID', 0];

  switch (topReason) {
    case 'MISSING_GAUGE':
      return 'Improve gauge extraction for misclassified wires';
    case 'NO_WIRES_DETECTED':
      return 'Improve wire detection heuristics or source data';
    case 'CLASSIFICATION_WEAK':
      return 'Improve classification system for UNKNOWN components';
    case 'HEAVY_RECOVERY_DEPENDENCE':
      return 'Review canonical classification accuracy in DB';
    default:
      return 'Consider controlled DB reset + re-ingestion';
  }
}

runCopperFailureScan().catch((error) => {
  console.error('Copper failure diagnostic scan failed:', error);
  process.exit(1);
});
