import { redirect } from 'next/navigation';

// Legacy route retained for backward compatibility. Vault is the canonical upload path.
export default function LegacyDrawingUploadRoute() {
  redirect('/vault?docType=CUSTOMER_DRAWING&actionIntent=UPLOAD_MISSING_DOC');
}