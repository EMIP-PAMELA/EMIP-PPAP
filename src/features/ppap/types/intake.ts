export interface IntakeRecord {
  id: string;
  part_number: string;
  customer_name: string;
  quoteStatus: 'confirmed' | 'pending';
  toolingStatus: 'validated' | 'pending';
  bomStatus: 'validated' | 'pending';
  materialRisk: 'none' | 'risk';
  plantAssigned: string | null;
}

export function isReadyForPPAP(intake: IntakeRecord): boolean {
  return (
    intake.quoteStatus === 'confirmed' &&
    intake.toolingStatus === 'validated' &&
    intake.bomStatus === 'validated' &&
    intake.materialRisk !== 'risk' &&
    intake.plantAssigned !== null
  );
}
