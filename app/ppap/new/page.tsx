import Link from 'next/link';
import { CreatePPAPForm } from '@/src/features/ppap/components/CreatePPAPForm';

export default function NewPPAPPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/ppap"
            className="inline-block text-blue-600 hover:text-blue-800 text-sm font-semibold transition-colors mb-4"
          >
            ← Back to PPAP Operations Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create New PPAP</h1>
          <p className="text-gray-600 mt-1">
            Enter the initial information for this PPAP record
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <CreatePPAPForm />
        </div>
      </div>
    </div>
  );
}
