'use client';

// NOTE: This is the ACTIVE layout. Do NOT modify src/app/layout version.

/**
 * V6.1 EMIP System Shell - Global Layout
 * 
 * UI LAYER - Unified Navigation and App Structure
 * 
 * Responsibilities:
 * - Persistent sidebar navigation
 * - Top header bar
 * - Main content area wrapper
 * - Route-aware active states
 * 
 * Architecture:
 * - Pure UI component
 * - No business logic
 * - Wraps all application routes
 */

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavigationItem {
  label: string;
  path?: string;
  icon?: string;
  children?: NavigationItem[];
  disabled?: boolean;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: 'Dashboard',            path: '/emip-dashboard',   icon: '📊' },
  { label: 'PPAP',                 path: '/ppap',             icon: '📋' },
  {
    label: 'SKU Models',
    path: '/sku',
    icon: '🗂️',
    children: [
      { label: 'Upload BOM',     path: '/upload/bom',     icon: '📄' },
      { label: 'Upload Drawing', path: '/upload/drawing', icon: '📐' },
      { label: 'Bulk Upload (soon)', icon: '�', disabled: true },
    ],
  },
  { label: 'BOM Repository',       path: '/bom',              icon: '📑' },
  { label: 'Copper Index',         path: '/copper',           icon: '🔧' },
  { label: 'Analytics',            path: '/analytics',        icon: '📈' },
  { label: 'AI Classification',    path: '/ai-classification', icon: '🤖' },
  { label: 'Harness Instructions', path: '/harness-instructions', icon: '🔌' },
  { label: 'Work Instructions',    path: '/work-instructions',    icon: '🧾' },
  { label: 'Admin',                path: '/admin',            icon: '⚙️' },
];

interface EMIPLayoutProps {
  children: React.ReactNode;
}

export default function EMIPLayout({ children }: EMIPLayoutProps) {
  const pathname = usePathname();

  const isActive = (path?: string) => {
    if (!path) return false;
    if (path === '/emip-dashboard') {
      return pathname === path;
    }
    return pathname?.startsWith(path);
  };

  const isItemActive = (item: NavigationItem): boolean => {
    if (item.path && isActive(item.path)) return true;
    return item.children?.some(child => isItemActive(child)) ?? false;
  };

  const renderNavLink = (item: NavigationItem, isChild = false) => {
    const active = isItemActive(item);
    const baseClasses = isChild
      ? 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm'
      : 'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors';
    const stateClasses = active
      ? 'bg-blue-50 text-blue-700 font-medium'
      : 'text-gray-700 hover:bg-gray-50';

    const content = (
      <>
        {item.icon && <span className={isChild ? 'text-sm' : 'text-xl'}>{item.icon}</span>}
        <span>{item.label}</span>
        {item.disabled && <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">Soon</span>}
      </>
    );

    if (!item.path || item.disabled) {
      return (
        <div className={`${baseClasses} ${stateClasses} opacity-60 cursor-not-allowed`}>
          {content}
        </div>
      );
    }

    const href = item.path!;
    return (
      <Link
        href={href}
        className={`${baseClasses} ${stateClasses}`}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-10 h-16">
        <div className="flex items-center justify-between px-6 h-full">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600">EMIP</h1>
            <span className="text-sm text-gray-500">Engineering Master Intelligence Platform</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">System User</span>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm">
              U
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-white border-r border-gray-200 fixed left-0 top-16 bottom-0 overflow-y-auto">
          <nav className="p-4">
            <ul className="space-y-2">
              {NAVIGATION_ITEMS.map((item) => (
                <li key={item.path ?? item.label}>
                  {renderNavLink(item)}
                  {item.children && item.children.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {item.children.map(child => (
                        <li key={`${item.label}-${child.path ?? child.label}`}>
                          {renderNavLink(child, true)}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">
              <div>EMIP v6.1</div>
              <div>Core System</div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 ml-64 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
