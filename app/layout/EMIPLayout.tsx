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
import { useTheme } from '@/src/features/theme/ThemeContext';

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
      { label: 'Document Vault', path: '/vault',          icon: '�️' },
      { label: 'Bulk Upload (soon)', icon: '⚙️', disabled: true },
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
  const { theme, toggleTheme } = useTheme();

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
      ? 'flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors'
      : 'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors';
    const stateClasses = active
      ? 'bg-blue-50 text-blue-700 font-medium dark:bg-slate-800 dark:text-blue-400'
      : 'text-gray-700 hover:bg-gray-50 dark:text-slate-400 dark:hover:bg-slate-700';

    const content = (
      <>
        {item.icon && <span className={isChild ? 'text-sm' : 'text-xl'}>{item.icon}</span>}
        <span>{item.label}</span>
        {item.disabled && (
          <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400 dark:text-slate-600">
            Soon
          </span>
        )}
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
      <Link href={href} className={`${baseClasses} ${stateClasses}`}>
        {content}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-150">
      {/* Top Header Bar */}
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 fixed top-0 left-0 right-0 z-10 h-16 transition-colors duration-150">
        <div className="flex items-center justify-between px-6 h-full">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">EMIP</h1>
            <span className="text-sm text-gray-500 dark:text-slate-400">
              Engineering Master Intelligence Platform
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* T22: Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              aria-label="Toggle theme"
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            <span className="text-sm text-gray-600 dark:text-slate-400">System User</span>
            <div className="w-8 h-8 bg-blue-500 dark:bg-blue-700 rounded-full flex items-center justify-center text-white text-sm">
              U
            </div>
          </div>
        </div>
      </header>

      <div className="flex pt-16">
        {/* Left Sidebar Navigation */}
        <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 fixed left-0 top-16 bottom-0 overflow-y-auto transition-colors duration-150">
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

          {/* Sidebar Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 transition-colors duration-150">
            <div className="text-xs text-gray-500 dark:text-slate-500">
              <div>EMIP v6.1</div>
              <div>Core System</div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 ml-64 p-8 dark:text-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
}
