'use client';

/**
 * V6.4.2 EMIP System Shell - Copper Index Page (Interactive Drilldown + Calibration)
 * 
 * UI LAYER - Interactive Family Copper Index
 * 
 * Responsibilities:
 * - Display family-level copper aggregation
 * - Enable clickable family drilldown to SKUs
 * - Allow SKU selection and dynamic recomputation
 * - Provide calibration input UI
 * - Show calibration metrics (gross/copper/insulation)
 * 
 * Architecture:
 * - Consumes computeFamilyCopperIndex from bomService
 * - Interactive component with selection state
 * - Dynamic recalculation based on filters
 */

import React, { useEffect, useState } from 'react';
import EMIPLayout from '../layout/EMIPLayout';
import Link from 'next/link';
import { getAllActiveBOMs, getBOM, computeFamilyCopperIndex, computeSKUInsights, filterSelectedSKUs, loadCalibrationFromDB, getActiveCalibrations, type FamilyCopperIndex } from '@/src/core/services/bomService';

interface SKUData {
  partNumber: string;
  records: any[];
}

export default function CopperPage() {
  const [familyIndex, setFamilyIndex] = useState<Record<string, FamilyCopperIndex>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCopper, setTotalCopper] = useState(0);
  const [totalGross, setTotalGross] = useState(0);
  const [totalInsulation, setTotalInsulation] = useState(0);
  const [totalSKUs, setTotalSKUs] = useState(0);
  
  // V6.4.2: Interactive state
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [familySKUs, setFamilySKUs] = useState<Record<string, SKUData[]>>({});
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const [selectedSKUs, setSelectedSKUs] = useState<string[]>([]);
  
  // V6.4.3: Calibration state
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [activeCalibrations, setActiveCalibrations] = useState<any[]>([]);
  const [calGauge, setCalGauge] = useState('');
  const [calCopper, setCalCopper] = useState('');
  const [calGross, setCalGross] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCopperData();
    loadCalibrations();
  }, []);
  
  // V6.4.2: Dynamic recomputation when selection changes
  useEffect(() => {
    if (allRecords.length === 0) return;
    
    const filteredRecords = selectedSKUs.length > 0
      ? filterSelectedSKUs(allRecords, selectedSKUs)
      : allRecords;
    
    const index = computeFamilyCopperIndex(filteredRecords);
    
    let copper = 0;
    let gross = 0;
    let insulation = 0;
    let skus = 0;
    
    Object.values(index).forEach(family => {
      copper += family.totalCopper;
      gross += family.totalGross;
      insulation += family.totalInsulation;
      skus += family.skuCount;
    });
    
    setFamilyIndex(index);
    setTotalCopper(copper);
    setTotalGross(gross);
    setTotalInsulation(insulation);
    setTotalSKUs(skus);
  }, [selectedSKUs, allRecords]);
  
  // V6.4.2: Interaction handlers
  const toggleSKU = (partNumber: string) => {
    setSelectedSKUs(prev =>
      prev.includes(partNumber)
        ? prev.filter(p => p !== partNumber)
        : [...prev, partNumber]
    );
  };
  
  const selectAllSKUs = () => {
    const allPartNumbers = Object.values(familySKUs)
      .flat()
      .map(sku => sku.partNumber);
    setSelectedSKUs(allPartNumbers);
  };
  
  const clearSelection = () => {
    setSelectedSKUs([]);
  };
  
  const toggleFamily = (family: string) => {
    setExpandedFamily(expandedFamily === family ? null : family);
  };
  
  // V6.4.3: Load calibration data from API
  const loadCalibrations = async () => {
    try {
      await loadCalibrationFromDB();
      const calibrations = getActiveCalibrations();
      const calibrationArray = Object.values(calibrations);
      setActiveCalibrations(calibrationArray);
      setCalibrationActive(calibrationArray.length > 0);
    } catch (err) {
      console.error('Error loading calibrations:', err);
    }
  };
  
  // V6.4.3: Save calibration to database
  const saveCalibration = async () => {
    if (!calGauge || !calCopper || !calGross) {
      alert('Please enter gauge, copper, and gross weight values');
      return;
    }
    
    const copperNum = parseFloat(calCopper);
    const grossNum = parseFloat(calGross);
    
    if (isNaN(copperNum) || isNaN(grossNum)) {
      alert('Copper and gross weights must be valid numbers');
      return;
    }
    
    if (copperNum > grossNum) {
      alert('Copper weight cannot exceed gross weight');
      return;
    }
    
    setSaving(true);
    
    try {
      const response = await fetch('/api/calibration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gauge: calGauge,
          copper: copperNum,
          gross: grossNum
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to save calibration');
      }
      
      // Clear inputs
      setCalGauge('');
      setCalCopper('');
      setCalGross('');
      
      // Reload calibrations and data
      await loadCalibrations();
      await loadCopperData();
      
      alert(`Calibration saved for AWG ${calGauge}!`);
    } catch (err) {
      console.error('Error saving calibration:', err);
      alert('Failed to save calibration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const loadCopperData = async () => {
    try {
      // V6.4.1: Get all active BOMs first
      const activeBOMs = await getAllActiveBOMs();
      
      if (activeBOMs.length === 0) {
        setLoading(false);
        return;
      }

      // V6.4.1: Fetch BOM records for each active part number
      const allRecords = [];
      for (const bom of activeBOMs) {
        try {
          const records = await getBOM(bom.partNumber);
          allRecords.push(...records);
        } catch (err) {
          console.warn(`Skipping ${bom.partNumber}:`, err);
        }
      }

      // V6.4.1: Compute family copper index
      const index = computeFamilyCopperIndex(allRecords);
      
      // V6.4.1: Calculate totals
      let copper = 0;
      let gross = 0;
      let insulation = 0;
      let skus = 0;
      
      Object.values(index).forEach(family => {
        copper += family.totalCopper;
        gross += family.totalGross;
        insulation += family.totalInsulation;
        skus += family.skuCount;
      });
      
      // V6.4.2: Store all records for filtering
      setAllRecords(allRecords);
      
      // V6.4.2: Group SKUs by family
      const skuGroups: Record<string, SKUData[]> = {};
      const partNumberMap: Record<string, any[]> = {};
      
      allRecords.forEach(record => {
        const pn = record.parent_part_number || 'UNKNOWN';
        if (!partNumberMap[pn]) partNumberMap[pn] = [];
        partNumberMap[pn].push(record);
      });
      
      Object.entries(partNumberMap).forEach(([partNumber, records]) => {
        const familyMatch = partNumber.match(/^\w*45-(\d+)-/);
        const family = familyMatch ? familyMatch[1] : 'UNKNOWN';
        
        if (!skuGroups[family]) skuGroups[family] = [];
        skuGroups[family].push({ partNumber, records });
      });
      
      setFamilySKUs(skuGroups);
      setFamilyIndex(index);
      setTotalCopper(copper);
      setTotalGross(gross);
      setTotalInsulation(insulation);
      setTotalSKUs(skus);
      
      console.log('🧠 V6.4.2 UI LOADED', {
        familyCount: Object.keys(index).length,
        totalCopper: copper.toFixed(4),
        totalGross: gross.toFixed(4),
        skuGroupCount: Object.keys(skuGroups).length
      });
      
      setLoading(false);
    } catch (err) {
      console.error('🧭 [Copper Page] Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load copper data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-lg text-gray-600">Calculating copper usage...</p>
          </div>
        </div>
      </EMIPLayout>
    );
  }

  if (error) {
    return (
      <EMIPLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <p className="text-lg text-gray-900 mb-2">Error Loading Copper Data</p>
            <p className="text-sm text-gray-600">{error}</p>
            <button
              onClick={() => loadCopperData()}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </EMIPLayout>
    );
  }

  return (
    <EMIPLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Copper Index</h1>
            <p className="text-gray-600 mt-1">Wire Weight Intelligence & Analytics</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600">Total Copper Weight</div>
            <div className="text-3xl font-bold text-orange-700">{totalCopper.toFixed(2)} lbs</div>
          </div>
        </div>

        {/* V6.4.2: Selection Controls */}
        {Object.keys(familyIndex).length > 0 && (
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={selectAllSKUs}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
            >
              Select All SKUs
            </button>
            <button
              onClick={clearSelection}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm font-medium"
            >
              Clear Selection
            </button>
            {selectedSKUs.length > 0 && (
              <span className="text-sm text-gray-600">
                {selectedSKUs.length} SKU{selectedSKUs.length !== 1 ? 's' : ''} selected
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-gray-600">Calibration:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                calibrationActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {calibrationActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        )}

        {/* V6.4.1: Enhanced Summary Cards */}
        {Object.keys(familyIndex).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total Families</div>
              <div className="text-2xl font-bold text-gray-900">{Object.keys(familyIndex).length}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total SKUs</div>
              <div className="text-2xl font-bold text-gray-900">{totalSKUs}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total Gross Weight</div>
              <div className="text-2xl font-bold text-gray-900">{totalGross.toFixed(3)} lbs</div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-600">Total Insulation</div>
              <div className="text-2xl font-bold text-gray-900">{totalInsulation.toFixed(3)} lbs</div>
            </div>
          </div>
        )}

        {/* V6.4.1: Family Index Table */}
        {Object.keys(familyIndex).length > 0 ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Family Copper Index</h2>
              <p className="text-sm text-gray-600 mt-1">Aggregated wire weight metrics by family</p>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Family
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU Count
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Length
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Copper Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Insulation Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Gross Weight
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.values(familyIndex)
                  .sort((a, b) => a.family.localeCompare(b.family))
                  .map((family) => (
                    <React.Fragment key={family.family}>
                      <tr 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleFamily(family.family)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">
                              {expandedFamily === family.family ? '▼' : '▶'}
                            </span>
                            <div className="text-sm font-medium text-blue-600">
                              {family.family}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                            {family.skuCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-blue-600 font-semibold">
                            {family.totalLength.toFixed(1)} ft
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-orange-600 font-semibold">
                            {family.totalCopper.toFixed(3)} lbs
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-green-600 font-semibold">
                            {family.totalInsulation.toFixed(3)} lbs
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-purple-600 font-semibold">
                            {family.totalGross.toFixed(3)} lbs
                          </span>
                        </td>
                      </tr>
                      
                      {/* V6.4.2: Expanded SKU View */}
                      {expandedFamily === family.family && familySKUs[family.family] && (
                        <tr>
                          <td colSpan={6} className="px-6 py-4 bg-gray-50">
                            <div className="space-y-2">
                              <div className="text-sm font-semibold text-gray-700 mb-3">
                                SKUs in Family {family.family}
                              </div>
                              {familySKUs[family.family].map((sku) => {
                                const insights = computeSKUInsights(sku.records);
                                const isSelected = selectedSKUs.includes(sku.partNumber);
                                
                                return (
                                  <div
                                    key={sku.partNumber}
                                    className="flex items-center gap-4 p-3 bg-white rounded border border-gray-200 hover:border-blue-300"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleSKU(sku.partNumber);
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSKU(sku.partNumber)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-4 h-4 text-blue-600 rounded"
                                    />
                                    <div className="flex-1 grid grid-cols-5 gap-4 text-sm">
                                      <div>
                                        <Link
                                          href={`/bom/${sku.partNumber}`}
                                          className="font-medium text-blue-600 hover:underline"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {sku.partNumber}
                                        </Link>
                                      </div>
                                      <div className="text-gray-600">
                                        <span className="font-medium">Length:</span> {insights.totalWireLength.toFixed(1)} ft
                                      </div>
                                      <div className="text-orange-600">
                                        <span className="font-medium">Copper:</span> {insights.estimatedCopperWeight.toFixed(3)} lbs
                                      </div>
                                      <div className="text-green-600">
                                        <span className="font-medium">Insulation:</span> {insights.estimatedInsulationWeight.toFixed(3)} lbs
                                      </div>
                                      <div className="text-purple-600">
                                        <span className="font-medium">Gross:</span> {insights.estimatedGrossWeight.toFixed(3)} lbs
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No BOM Data Available</h3>
            <p className="text-gray-500">Upload BOMs to see family copper index</p>
          </div>
        )}

        {/* V6.4.2: Calibration Input Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="border-b border-gray-200 pb-4 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Wire Calibration (10 ft Sample Method)</h2>
            <p className="text-sm text-gray-600 mt-1">
              Enter measured weights from a 10-foot wire sample to override AWG defaults
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 text-xl">ℹ️</span>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How to calibrate:</p>
                <ol className="list-decimal ml-4 space-y-1">
                  <li>Cut exactly 10 feet of wire</li>
                  <li>Weigh the entire sample (gross weight)</li>
                  <li>Strip the insulation and weigh copper only</li>
                  <li>Calculate insulation weight (gross - copper)</li>
                  <li>Divide all weights by 10 to get lbs/ft</li>
                  <li>Enter values below and save</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gauge (AWG)</label>
              <input
                type="text"
                placeholder="e.g., 18"
                value={calGauge}
                onChange={(e) => setCalGauge(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Copper (lbs/ft)</label>
              <input
                type="number"
                step="0.0001"
                placeholder="0.0160"
                value={calCopper}
                onChange={(e) => setCalCopper(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gross (lbs/ft)</label>
              <input
                type="number"
                step="0.0001"
                placeholder="0.0185"
                value={calGross}
                onChange={(e) => setCalGross(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {calCopper && calGross && (
            <div className="mt-2 text-sm text-gray-600">
              <span className="font-medium">Auto-calculated Insulation:</span>{' '}
              {(parseFloat(calGross) - parseFloat(calCopper)).toFixed(4)} lbs/ft
            </div>
          )}

          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={saveCalibration}
              disabled={saving || !calGauge || !calCopper || !calGross}
              className={`px-4 py-2 rounded font-medium ${
                saving || !calGauge || !calCopper || !calGross
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {saving ? 'Saving...' : 'Save Calibration'}
            </button>
            <span className="text-sm text-green-600">
              ✅ Calibration will be saved to database and applied immediately
            </span>
          </div>

          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Current Calibrations</h3>
            {activeCalibrations.length > 0 ? (
              <div className="space-y-2">
                {activeCalibrations.map((cal) => (
                  <div key={cal.gauge} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                    <span className="font-medium text-gray-900">AWG {cal.gauge}</span>
                    <div className="flex gap-6 text-sm text-gray-600">
                      <span>Copper: <span className="font-medium text-orange-600">{cal.copperLbsPerFt.toFixed(4)}</span> lbs/ft</span>
                      <span>Insulation: <span className="font-medium text-green-600">{cal.insulationLbsPerFt.toFixed(4)}</span> lbs/ft</span>
                      <span>Gross: <span className="font-medium text-purple-600">{cal.grossLbsPerFt.toFixed(4)}</span> lbs/ft</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-600">
                No custom calibrations active. Using AWG standard values.
              </p>
            )}
          </div>
        </div>
      </div>
    </EMIPLayout>
  );
}
