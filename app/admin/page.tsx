'use client';

import Link from 'next/link';
import EMIPLayout from '@/app/layout/EMIPLayout';

const ADMIN_LINKS = [
  {
    label: 'Classification Backfill',
    path: '/admin/backfill',
    description: 'Re-run classification pass on BOM records with missing or UNKNOWN categories.',
  },
  {
    label: 'User Management',
    path: '/admin/users',
    description: 'View and update user roles and permissions.',
  },
  {
    label: 'Customer Records',
    path: '/admin/customers',
    description: 'Manage customer reference data.',
  },
  {
    label: 'Document Templates',
    path: '/admin/templates',
    description: 'Configure PPAP document templates.',
  },
];

export default function AdminIndexPage() {
  return (
    <EMIPLayout>
      <div className="max-w-2xl space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
          <p className="mt-1 text-sm text-gray-500">System administration tools. Changes here affect all users.</p>
        </header>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Admin actions are not access-controlled in the current build. Use with care.
        </div>

        <ul className="space-y-2">
          {ADMIN_LINKS.map(link => (
            <li key={link.path}>
              <Link
                href={link.path}
                className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-blue-200 hover:bg-blue-50/40 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{link.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{link.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </EMIPLayout>
  );
}
