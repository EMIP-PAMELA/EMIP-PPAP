'use client';

import { PPAPRecord } from '@/src/types/database.types';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/src/lib/utils';
import { useMemo, useState } from 'react';
import { enhancePPAPRecord, sortPPAPs, filterPPAPs, searchPPAPs, paginatePPAPs, getStateBadgeStyle, getRowBackgroundStyle, getStatusIndicator, getAttentionColor, SortConfig, SortField, FilterConfig, PhaseFilter, PaginationConfig } from '../utils/ppapTableHelpers';
import { currentUser } from '@/src/lib/mockUser';
import { isReadOnly } from '../utils/permissions';
import { calculateDocumentProgress, getHealthStatus, getHealthBadgeStyle, getHealthBadgeIcon, getStatusClarityTag } from '../utils/documentHelpers';
import { mapStatusToPhase } from '../utils/stateWorkflowMapping';
import { WORKFLOW_PHASE_LABELS } from '../constants/workflowPhases';
import { validatePlantForDisplay } from '../utils/plantValidation';

/**
 * Phase 3H.9: Safe user name formatting (React #418 fix)
 * Input: username string or object (defensive)
 * Output: Formatted name (e.g., "Matt R.", "Unassigned")
 * 
 * CRITICAL: Handles object types safely to prevent React error #418
 */
function formatUserName(user: unknown): string {
  // Phase 3H.9: Guard against object rendering (React #418)
  if (!user || typeof user === 'object') {
    return 'Unassigned';
  }
  
  // Ensure we have a string
  const userName = String(user);
  
  // Handle known usernames with proper formatting
  const nameParts = userName.split(' ');
  if (nameParts.length >= 2) {
    const first = nameParts[0];
    const lastInitial = nameParts[1][0] + '.';
    return `${first} ${lastInitial}`;
  }
  
  // Single name or unknown format
  return userName;
}

interface PPAPDashboardTableProps {
  ppaps: PPAPRecord[];
}

export function PPAPDashboardTable({ ppaps }: PPAPDashboardTableProps) {
  const router = useRouter();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filters, setFilters] = useState<FilterConfig>({
    customers: [],
    states: [],
    engineers: [],
    plants: [],
    phase: 'All',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const enhancedPPAPs = useMemo(() => {
    return ppaps.map(ppap => enhancePPAPRecord(ppap));
  }, [ppaps]);

  const filterOptions = useMemo(() => {
    const customers = Array.from(new Set(enhancedPPAPs.map(p => p.customer_name))).sort();
    const states = Array.from(new Set(enhancedPPAPs.map(p => p.derivedState))).sort();
    const engineers = Array.from(
      new Set(enhancedPPAPs.map(p => p.assigned_to || 'Unassigned'))
    ).sort();
    const plants = Array.from(new Set(enhancedPPAPs.map(p => p.plant))).sort();
    
    return { customers, states, engineers, plants };
  }, [enhancedPPAPs]);

  const filteredPPAPs = useMemo(() => {
    const sorted = sortPPAPs(enhancedPPAPs, sortConfig);
    return filterPPAPs(sorted, filters);
  }, [enhancedPPAPs, sortConfig, filters]);

  const searchedPPAPs = useMemo(() => {
    return searchPPAPs(filteredPPAPs, searchQuery);
  }, [filteredPPAPs, searchQuery]);

  const totalItems = searchedPPAPs.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  const paginatedPPAPs = useMemo(() => {
    return paginatePPAPs(searchedPPAPs, {
      currentPage,
      pageSize
    });
  }, [searchedPPAPs, currentPage, pageSize]);

  const handleRowClick = (ppapId: string) => {
    if (isReadOnly(currentUser.role)) {
      return;
    }
    router.push(`/ppap/${ppapId}`);
  };

  const handleSort = (field: SortField) => {
    setSortConfig(current => {
      if (!current || current.field !== field) {
        return { field, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { field, direction: 'desc' };
      }
      return null;
    });
  };

  const getSortIndicator = (field: SortField) => {
    if (!sortConfig || sortConfig.field !== field) return null;
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓';
  };

  const handleFilterChange = (filterType: keyof FilterConfig, value: string) => {
    setCurrentPage(1);
    setFilters(current => {
      if (filterType === 'phase') {
        return { ...current, phase: value as PhaseFilter };
      }
      
      const currentArray = current[filterType] as string[];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(v => v !== value)
        : [...currentArray, value];
      
      return { ...current, [filterType]: newArray };
    });
  };

  const handleSearchChange = (query: string) => {
    setCurrentPage(1);
    setSearchQuery(query);
  };

  const handlePageSizeChange = (size: number) => {
    setCurrentPage(1);
    setPageSize(size);
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const clearFilters = () => {
    setFilters({
      customers: [],
      states: [],
      engineers: [],
      plants: [],
      phase: 'All',
    });
  };

  const hasActiveFilters = filters.customers.length > 0 || 
    filters.states.length > 0 || 
    filters.engineers.length > 0 || 
    filters.plants.length > 0 || 
    filters.phase !== 'All';

  if (ppaps.length === 0) {
    return (
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-12 text-center">
        <p className="text-gray-600 text-lg">No PPAPs found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-4">
        <input
          type="text"
          placeholder="Search Part Number or PPAP ID..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Customer</label>
            <select
              multiple
              value={filters.customers}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange('customers', value);
              }}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              size={3}
            >
              {filterOptions.customers.map(customer => (
                <option key={customer} value={customer}>
                  {customer}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
            <select
              multiple
              value={filters.states}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange('states', value);
              }}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              size={3}
            >
              {filterOptions.states.map(state => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Assigned Engineer</label>
            <select
              multiple
              value={filters.engineers}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange('engineers', value);
              }}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              size={3}
            >
              {filterOptions.engineers.map(engineer => (
                <option key={engineer} value={engineer}>
                  {engineer}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Plant</label>
            <select
              multiple
              value={filters.plants}
              onChange={(e) => {
                const value = e.target.value;
                handleFilterChange('plants', value);
              }}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              size={3}
            >
              {filterOptions.plants.map(plant => (
                <option key={plant} value={plant}>
                  {plant}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-700 mb-1">Phase</label>
            <select
              value={filters.phase}
              onChange={(e) => setFilters(current => ({ ...current, phase: e.target.value as PhaseFilter }))}
              className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            >
              <option value="All">All</option>
              <option value="Pre-Ack">Pre-Ack</option>
              <option value="Post-Ack">Post-Ack</option>
              <option value="Final">Final</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded hover:bg-gray-700 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 text-sm text-gray-600">
          {searchQuery && (
            <span>Search results: {searchedPPAPs.length} PPAPs | </span>
          )}
          {hasActiveFilters && (
            <span>Filtered: {filteredPPAPs.length} of {enhancedPPAPs.length} | </span>
          )}
          <span>Showing {paginatedPPAPs.length} of {totalItems} PPAPs (Page {currentPage} of {totalPages})</span>
        </div>
      </div>

      <div className="bg-white border border-gray-300 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-300">
            <tr>
              <th 
                onClick={() => handleSort('ppap_number')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                PPAP ID{getSortIndicator('ppap_number')}
              </th>
              <th 
                onClick={() => handleSort('part_number')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Part Number{getSortIndicator('part_number')}
              </th>
              <th 
                onClick={() => handleSort('customer_name')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Customer{getSortIndicator('customer_name')}
              </th>
              <th 
                onClick={() => handleSort('state')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Current State{getSortIndicator('state')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Document Progress
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Health
              </th>
              <th 
                onClick={() => handleSort('phase')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Phase{getSortIndicator('phase')}
              </th>
              <th 
                onClick={() => handleSort('assigned_to')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Assigned Engineer{getSortIndicator('assigned_to')}
              </th>
              <th 
                onClick={() => handleSort('plant')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Production Plant{getSortIndicator('plant')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Template
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Coordinator
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Validation
              </th>
              <th 
                onClick={() => handleSort('acknowledgement')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Acknowledgement{getSortIndicator('acknowledgement')}
              </th>
              <th 
                onClick={() => handleSort('submission')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Submission{getSortIndicator('submission')}
              </th>
              <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                Attention
              </th>
              <th 
                onClick={() => handleSort('updated_at')}
                className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-200 transition-colors"
              >
                Last Updated{getSortIndicator('updated_at')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {paginatedPPAPs.map((ppap) => {
              const statusIndicator = getStatusIndicator(ppap.derivedState);
              const rowBgClass = getRowBackgroundStyle(ppap.derivedPhase, ppap.derivedState);
              
              const isClickable = !isReadOnly(currentUser.role);
              
              // Phase 3H.5: Calculate document progress and health
              const docProgress = calculateDocumentProgress(ppap);
              const healthStatus = getHealthStatus(ppap, docProgress);
              const clarityTag = getStatusClarityTag(ppap.status);
              
              // Phase 3H.8: Derive phase from status (single source of truth)
              const derivedPhase = mapStatusToPhase(ppap.status);
              const phaseLabel = WORKFLOW_PHASE_LABELS[derivedPhase] || derivedPhase;
              
              // Phase 3H.8: Format assigned engineer
              const formattedEngineer = formatUserName(ppap.assigned_to);
              
              // Phase 3H.9: Validate plant for display
              const validatedPlant = validatePlantForDisplay(ppap.plant, ppap.id);
              
              return (
              <tr
                key={ppap.id}
                onClick={() => handleRowClick(ppap.id)}
                className={`${isClickable ? 'hover:bg-gray-100 cursor-pointer' : 'cursor-not-allowed opacity-75'} transition-colors ${rowBgClass}`}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-blue-700">
                  {ppap.ppap_number}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                  {ppap.part_number}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {ppap.customer_name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1">
                      {statusIndicator && <span className="text-base">{statusIndicator}</span>}
                      <span className={getStateBadgeStyle(ppap.derivedState)}>
                        {ppap.derivedState.replace(/_/g, ' ')}
                      </span>
                    </div>
                    {/* Phase 3H.5: Status Clarity Tag */}
                    <span className="text-xs text-gray-600 italic">
                      {clarityTag}
                    </span>
                  </div>
                </td>
                {/* Phase 3H.5: Document Progress */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-gray-700">
                      {docProgress.complete} / {docProgress.total} Docs Complete
                    </span>
                    {/* Progress Bar */}
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all"
                        style={{ width: `${docProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                </td>
                {/* Phase 3H.5: Health Indicator Badge */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold border ${getHealthBadgeStyle(healthStatus)}`}>
                    <span>{getHealthBadgeIcon(healthStatus)}</span>
                    <span>{healthStatus}</span>
                  </span>
                </td>
                {/* Phase 3H.8: Phase Column - Derived from status */}
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-700">
                  {phaseLabel}
                </td>
                {/* Phase 3H.8: Assigned Engineer Column - Formatted user name */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {formattedEngineer === 'Unassigned' ? (
                    <span className="text-gray-400">{formattedEngineer}</span>
                  ) : (
                    <span className="font-medium">{formattedEngineer}</span>
                  )}
                </td>
                {/* Phase 3H.8: Production Plant Column - Validated plant value */}
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {validatedPlant === '—' ? (
                    <span className="text-gray-400">{validatedPlant}</span>
                  ) : (
                    <span className="font-medium">{validatedPlant}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-sm font-medium ${
                    ppap.customerType === 'TRANE' ? 'text-blue-600' : 'text-green-600'
                  }`}>
                    {ppap.customerType === 'TRANE' ? '🔵 Trane' : '🟢 Rheem'}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                  {ppap.coordinator}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                  {ppap.validationSummary}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.acknowledgementStatus}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {ppap.submissionStatus}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`text-sm font-medium ${getAttentionColor(ppap.attentionStatus)}`}>
                    {ppap.attentionStatus}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                  {formatDate(ppap.updated_at)}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>

      {searchedPPAPs.length === 0 && (searchQuery || hasActiveFilters) && (
        <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-12 text-center">
          <p className="text-gray-600 text-lg">
            {searchQuery ? 'No PPAPs match your search' : 'No PPAPs match current filters'}
          </p>
          <div className="mt-4 space-x-2">
            {searchQuery && (
              <button
                onClick={() => handleSearchChange('')}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition-colors"
              >
                Clear Search
              </button>
            )}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 transition-colors"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>
      )}

      {totalItems > 0 && (
        <div className="bg-white border border-gray-300 rounded-xl shadow-sm p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
