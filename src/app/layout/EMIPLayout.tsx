'use client';

/**
 * V6.0 EMIP System Shell - Global Layout
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
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavigationItem {
  label: string;
  path: string;
  icon?: string;
}

const NAVIGATION_ITEMS: NavigationItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: '📊' },
  { label: 'PPAP', path: '/ppap', icon: '📋' },
  { label: 'BOM Repository', path: '/bom', icon: '🗂️' },
  { label: 'Copper Index', path: '/copper', icon: '🔧' },
  { label: 'Analytics', path: '/analytics', icon: '📈' },
  { label: 'Admin', path: '/admin', icon: '⚙️' }
];

interface EMIPLayoutProps {
  children: React.ReactNode;
}

export default function EMIPLayout({ children }: EMIPLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return pathname === path;
    }
    return pathname?.startsWith(path);
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
                <li key={item.path}>
                  <Link
                    href={item.path}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                      ${isActive(item.path) 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Footer Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
            <div className="text-xs text-gray-500">
              <div>EMIP v6.0</div>
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
