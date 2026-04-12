import { redirect } from 'next/navigation';

// Legacy route retained for backward compatibility. Vault is the canonical upload path.
export default function LegacyBOMUploadRoute() {
  redirect('/vault?docType=BOM&actionIntent=UPLOAD_MISSING_DOC');
}