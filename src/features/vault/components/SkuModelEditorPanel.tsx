'use client';

/**
 * SkuModelEditorPanel — Phase T12
 *
 * SKU-level authoritative wire model editor. Operators can:
 *   - View the effective harness connectivity (extracted + operator overlays)
 *   - Add missing wires
 *   - Edit any wire's endpoints, pin mapping, length, gauge, topology
 *   - Delete incorrect wires from the effective model
 *
 * Authority hierarchy: OPERATOR_MODEL > extracted OCR/VISION
 *
 * Governance:
 *   - Pure UI. All mutations flow via onAdd / onEdit / onDelete callbacks.
 *   - Original extracted connectivity is displayed for traceability.
 *   - No direct writes to extraction pipeline.
 */

import React, { useState, useCallback } from 'react';
import type {
  HarnessConnectivityResult,
  WireConnectivity,
} from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type {
  OperatorWireModel,
  WireTopology,
  OperatorWireBranch,
} from '@/src/features/harness-work-instructions/services/skuModelEditService';
import {
  makeEmptyOperatorWire,
  wireConnectivityToOperatorModel,
} from '@/src/features/harness-work-instructions/services/skuModelEditService';
import type { EffectiveSkuHarnessModel } from '@/src/features/harness-work-instructions/services/skuModelEditService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SkuModelEditorPanelProps {
  extractedConnectivity: HarnessConnectivityResult | null;
  effectiveModel: EffectiveSkuHarnessModel | null;
  operatorAddedWires: OperatorWireModel[];
  operatorEditedWires: OperatorWireModel[];
  operatorDeletedWireIds: string[];
  onAddWire: (wire: OperatorWireModel) => void;
  onEditWire: (wire: OperatorWireModel) => void;
  onDeleteWire: (wireId: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOPOLOGY_OPTIONS: { value: WireTopology; label: string }[] = [
  { value: 'LINEAR',            label: 'Linear (standard)' },
  { value: 'BRANCH_DOUBLE_CRIMP', label: 'Branch / Double-Crimp' },
  { value: 'GROUND',            label: 'Ground' },
  { value: 'SPLICE',            label: 'Splice' },
  { value: 'FLOATING',          label: 'Floating (open end)' },
];

const dash = '—';

// ---------------------------------------------------------------------------
// Wire editor form
// ---------------------------------------------------------------------------

interface WireFormState {
  wireId: string;
  length: string;
  gauge: string;
  color: string;
  fromComponent: string;
  fromCavity: string;
  fromTreatment: string;
  toComponent: string;
  toCavity: string;
  toTreatment: string;
  topology: WireTopology | '';
  branchSrcComp: string;
  branchSrcCav: string;
  branchSecCav: string;
  branchFerrulePN: string;
  branchTerminalPN: string;
  reason: string;
}

function emptyForm(): WireFormState {
  return {
    wireId: '', length: '', gauge: '', color: '',
    fromComponent: '', fromCavity: '', fromTreatment: '',
    toComponent: '', toCavity: '', toTreatment: '',
    topology: '', branchSrcComp: '', branchSrcCav: '', branchSecCav: '',
    branchFerrulePN: '', branchTerminalPN: '', reason: '',
  };
}

function wireToForm(wire: WireConnectivity | OperatorWireModel): WireFormState {
  const from = wire.from;
  const to   = wire.to;
  const isOp = (wire as OperatorWireModel).source === 'OPERATOR_MODEL';
  const opWire = isOp ? (wire as OperatorWireModel) : null;

  const branch: OperatorWireBranch | null = opWire?.branch ?? null;

  return {
    wireId:         wire.wireId,
    length:         wire.length != null ? String(wire.length) : '',
    gauge:          wire.gauge ?? '',
    color:          wire.color ?? '',
    fromComponent:  from.component ?? '',
    fromCavity:     from.cavity    ?? '',
    fromTreatment:  from.treatment ?? '',
    toComponent:    to.component   ?? '',
    toCavity:       to.cavity      ?? '',
    toTreatment:    to.treatment   ?? '',
    topology:       opWire?.topology ?? '',
    branchSrcComp:  branch?.sharedSourceComponent  ?? '',
    branchSrcCav:   branch?.sharedSourceCavity     ?? '',
    branchSecCav:   branch?.secondaryCavity        ?? '',
    branchFerrulePN:  branch?.ferrulePartNumber    ?? '',
    branchTerminalPN: branch?.terminalPartNumber   ?? '',
    reason:         opWire?.reason ?? '',
  };
}

function formToOperatorWire(
  form: WireFormState,
  existingId?: string,
  existingCreatedAt?: string,
): OperatorWireModel {
  const now = new Date().toISOString();
  const topology = (form.topology || null) as WireTopology | null;
  const branch: OperatorWireBranch | null =
    topology === 'BRANCH_DOUBLE_CRIMP'
      ? {
          sharedSourceComponent:  form.branchSrcComp   || null,
          sharedSourceCavity:     form.branchSrcCav    || null,
          secondaryCavity:        form.branchSecCav    || null,
          ferrulePartNumber:      form.branchFerrulePN || null,
          terminalPartNumber:     form.branchTerminalPN || null,
        }
      : null;

  return {
    id:          existingId ?? `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wireId:      form.wireId.trim(),
    length:      form.length !== '' ? parseFloat(form.length) : null,
    lengthUnit:  'in',
    gauge:       form.gauge.trim() || null,
    color:       form.color.trim() || null,
    from: {
      component: form.fromComponent.trim() || null,
      cavity:    form.fromCavity.trim()    || null,
      treatment: form.fromTreatment.trim() || null,
    },
    to: {
      component: form.toComponent.trim() || null,
      cavity:    form.toCavity.trim()    || null,
      treatment: form.toTreatment.trim() || null,
    },
    topology,
    branch,
    reason:      form.reason.trim(),
    source:      'OPERATOR_MODEL',
    authoritative: true,
    createdAt:   existingCreatedAt ?? now,
    updatedAt:   now,
  };
}

// ---------------------------------------------------------------------------
// Wire editor form component
// ---------------------------------------------------------------------------

interface WireEditorProps {
  initialForm: WireFormState;
  existingId?: string;
  existingCreatedAt?: string;
  mode: 'add' | 'edit';
  onSave: (wire: OperatorWireModel) => void;
  onCancel: () => void;
}

function WireEditorForm({ initialForm, existingId, existingCreatedAt, mode, onSave, onCancel }: WireEditorProps) {
  const [form, setForm] = useState<WireFormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof WireFormState, string>>>({});

  const set = (key: keyof WireFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm(prev => ({ ...prev, [key]: e.target.value }));

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.wireId.trim()) errs.wireId = 'Wire ID is required';
    if (!form.reason.trim()) errs.reason = 'Reason is required';
    if (form.length !== '' && isNaN(parseFloat(form.length))) errs.length = 'Must be a number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    onSave(formToOperatorWire(form, existingId, existingCreatedAt));
  };

  const labelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide';
  const inputCls = (err?: string) =>
    `w-full rounded border ${err ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'} px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400`;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-blue-700">
          {mode === 'add' ? '+ Add Wire' : `Edit Wire: ${initialForm.wireId || '…'}`}
        </p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-[11px]">
          Cancel
        </button>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Wire ID *</label>
          <input value={form.wireId} onChange={set('wireId')} className={inputCls(errors.wireId)} placeholder="W1, COM, GND…" readOnly={mode === 'edit'} />
          {errors.wireId && <p className="text-[10px] text-red-600 mt-0.5">{errors.wireId}</p>}
        </div>
        <div>
          <label className={labelCls}>Length (in)</label>
          <input value={form.length} onChange={set('length')} className={inputCls(errors.length)} placeholder="e.g. 9" />
          {errors.length && <p className="text-[10px] text-red-600 mt-0.5">{errors.length}</p>}
        </div>
        <div>
          <label className={labelCls}>Gauge (AWG)</label>
          <input value={form.gauge} onChange={set('gauge')} className={inputCls()} placeholder="18" />
        </div>
        <div>
          <label className={labelCls}>Color</label>
          <input value={form.color} onChange={set('color')} className={inputCls()} placeholder="BRN" />
        </div>
      </div>

      {/* FROM endpoint */}
      <div>
        <p className={`${labelCls} text-teal-700 mb-1`}>FROM endpoint</p>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className={labelCls}>Component</label>
            <input value={form.fromComponent} onChange={set('fromComponent')} className={inputCls()} placeholder="J1" />
          </div>
          <div>
            <label className={labelCls}>Cavity / Pin</label>
            <input value={form.fromCavity} onChange={set('fromCavity')} className={inputCls()} placeholder="1" />
          </div>
          <div>
            <label className={labelCls}>Treatment</label>
            <input value={form.fromTreatment} onChange={set('fromTreatment')} className={inputCls()} placeholder="SPLICE…" />
          </div>
        </div>
      </div>

      {/* TO endpoint */}
      <div>
        <p className={`${labelCls} text-indigo-700 mb-1`}>TO endpoint</p>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className={labelCls}>Component / Terminal PN</label>
            <input value={form.toComponent} onChange={set('toComponent')} className={inputCls()} placeholder="929504-1" />
          </div>
          <div>
            <label className={labelCls}>Cavity</label>
            <input value={form.toCavity} onChange={set('toCavity')} className={inputCls()} placeholder="" />
          </div>
          <div>
            <label className={labelCls}>Treatment</label>
            <input value={form.toTreatment} onChange={set('toTreatment')} className={inputCls()} placeholder="" />
          </div>
        </div>
      </div>

      {/* Topology */}
      <div>
        <label className={labelCls}>Topology</label>
        <select value={form.topology} onChange={set('topology')} className={inputCls()}>
          <option value="">— Standard (unspecified) —</option>
          {TOPOLOGY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Branch / Double-Crimp fields */}
      {form.topology === 'BRANCH_DOUBLE_CRIMP' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2 space-y-2">
          <p className={`${labelCls} text-amber-700`}>Branch / Double-Crimp data</p>
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className={labelCls}>Shared Source Component</label>
              <input value={form.branchSrcComp} onChange={set('branchSrcComp')} className={inputCls()} placeholder="PHOENIX 1700443" />
            </div>
            <div>
              <label className={labelCls}>Shared Source Cavity</label>
              <input value={form.branchSrcCav} onChange={set('branchSrcCav')} className={inputCls()} placeholder="2" />
            </div>
            <div>
              <label className={labelCls}>Secondary Cavity</label>
              <input value={form.branchSecCav} onChange={set('branchSecCav')} className={inputCls()} placeholder="5" />
            </div>
            <div>
              <label className={labelCls}>Ferrule PN</label>
              <input value={form.branchFerrulePN} onChange={set('branchFerrulePN')} className={inputCls()} placeholder="1381010" />
            </div>
            <div>
              <label className={labelCls}>Terminal PN</label>
              <input value={form.branchTerminalPN} onChange={set('branchTerminalPN')} className={inputCls()} placeholder="61944-1" />
            </div>
          </div>
        </div>
      )}

      {/* Reason */}
      <div>
        <label className={labelCls}>Reason * <span className="text-gray-400 normal-case font-normal">(required)</span></label>
        <textarea
          value={form.reason}
          onChange={set('reason')}
          rows={2}
          className={`w-full rounded border ${errors.reason ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'} px-2 py-1 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none`}
          placeholder="Explain why this wire is being added / changed…"
        />
        {errors.reason && <p className="text-[10px] text-red-600 mt-0.5">{errors.reason}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="px-3 py-1 text-[12px] rounded border border-gray-200 text-gray-600 hover:bg-gray-100">
          Cancel
        </button>
        <button type="button" onClick={handleSave}
          className="px-3 py-1 text-[12px] rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold">
          {mode === 'add' ? 'Add Wire' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel component
// ---------------------------------------------------------------------------

export default function SkuModelEditorPanel({
  extractedConnectivity,
  effectiveModel,
  operatorAddedWires,
  operatorEditedWires,
  operatorDeletedWireIds,
  onAddWire,
  onEditWire,
  onDeleteWire,
}: SkuModelEditorPanelProps) {
  const [editorState, setEditorState] = useState<
    | { mode: 'add'; form: WireFormState }
    | { mode: 'edit'; form: WireFormState; id: string; createdAt: string; wireId: string }
    | null
  >(null);

  const deletedSet  = new Set(operatorDeletedWireIds);
  const editedMap   = new Map(operatorEditedWires.map(w => [w.wireId, w]));
  const addedMap    = new Map(operatorAddedWires.map(w => [w.wireId, w]));

  const effectiveWires = effectiveModel?.connectivity.wires ?? extractedConnectivity?.wires ?? [];
  const overallDecision = effectiveModel?.decision.overallDecision ?? null;

  const openAddForm = useCallback(() => {
    setEditorState({ mode: 'add', form: emptyForm() });
  }, []);

  const openEditForm = useCallback((wire: WireConnectivity) => {
    const opVersion = editedMap.get(wire.wireId);
    const base = opVersion
      ? wireToForm(opVersion)
      : wireToForm(wire);
    setEditorState({
      mode: 'edit',
      form: base,
      id: opVersion?.id ?? `op-${wire.wireId}-${Date.now()}`,
      createdAt: opVersion?.createdAt ?? new Date().toISOString(),
      wireId: wire.wireId,
    });
  }, [editedMap]);

  const handleSave = useCallback((wire: OperatorWireModel) => {
    if (editorState?.mode === 'add') {
      onAddWire(wire);
    } else {
      onEditWire(wire);
    }
    setEditorState(null);
  }, [editorState, onAddWire, onEditWire]);

  const handleDelete = useCallback((wireId: string) => {
    if (confirm(`Delete wire "${wireId}" from effective model?`)) {
      onDeleteWire(wireId);
    }
  }, [onDeleteWire]);

  const decisionColor =
    overallDecision === 'SAFE' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    overallDecision === 'BLOCKED' ? 'text-red-700 bg-red-50 border-red-200' :
    overallDecision === 'REVIEW_REQUIRED' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-gray-500 bg-gray-50 border-gray-200';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden text-[12px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-400">T12 SKU Model</p>
          <h2 className="text-sm font-bold text-gray-900">Authoritative Wire Editor</h2>
        </div>
        <div className="flex items-center gap-2">
          {overallDecision && (
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${decisionColor}`}>
              {overallDecision}
            </span>
          )}
          <button
            type="button"
            onClick={openAddForm}
            className="px-3 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700"
          >
            + Add Wire
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex gap-4 px-4 py-2 border-b border-gray-100 bg-gray-50 text-[11px] text-gray-500">
        <span>Extracted: <strong className="text-gray-800">{extractedConnectivity?.wires.length ?? 0}</strong></span>
        <span>Effective: <strong className="text-gray-800">{effectiveWires.length}</strong></span>
        {operatorAddedWires.length > 0 && (
          <span className="text-blue-700">Added by Operator: <strong>{operatorAddedWires.length}</strong></span>
        )}
        {operatorEditedWires.length > 0 && (
          <span className="text-amber-700">Edited: <strong>{operatorEditedWires.length}</strong></span>
        )}
        {operatorDeletedWireIds.length > 0 && (
          <span className="text-red-600">Deleted: <strong>{operatorDeletedWireIds.length}</strong></span>
        )}
      </div>

      {/* Editor form (inline) */}
      {editorState && (
        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/20">
          <WireEditorForm
            initialForm={editorState.form}
            existingId={editorState.mode === 'edit' ? editorState.id : undefined}
            existingCreatedAt={editorState.mode === 'edit' ? editorState.createdAt : undefined}
            mode={editorState.mode}
            onSave={handleSave}
            onCancel={() => setEditorState(null)}
          />
        </div>
      )}

      {/* Operator-added wires (top section) */}
      {operatorAddedWires.length > 0 && (
        <div className="border-b border-blue-100">
          <div className="px-4 py-1.5 bg-blue-50/60 text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Added by Operator ({operatorAddedWires.length})
          </div>
          {operatorAddedWires.map(wire => (
            <AddedWireRow
              key={wire.id}
              wire={wire}
              onEdit={() => {
                setEditorState({
                  mode: 'edit',
                  form: wireToForm(wire),
                  id: wire.id,
                  createdAt: wire.createdAt,
                  wireId: wire.wireId,
                });
              }}
              onDelete={() => handleDelete(wire.wireId)}
            />
          ))}
        </div>
      )}

      {/* Extracted / effective wires */}
      <div className="max-h-[24rem] overflow-y-auto">
        {effectiveWires.length === 0 && operatorAddedWires.length === 0 ? (
          <div className="px-4 py-6 text-center text-gray-400 text-[11px]">
            No wire data — use Add Wire to build the model from scratch.
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="sticky top-0 z-10 grid grid-cols-[3rem_5rem_3rem_3rem_6rem_1rem_6rem_5rem_auto] gap-x-2 px-4 py-1 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              <span>Wire</span>
              <span>Length</span>
              <span>Gauge</span>
              <span>Color</span>
              <span>From</span>
              <span></span>
              <span>To</span>
              <span>Status</span>
              <span></span>
            </div>

            {effectiveWires.map(wire => {
              const isDeleted = deletedSet.has(wire.wireId);
              const isEdited  = editedMap.has(wire.wireId);
              const isAdded   = addedMap.has(wire.wireId);
              if (isAdded) return null; // shown in added section above

              return (
                <ExtractedWireRow
                  key={wire.wireId}
                  wire={wire}
                  isDeleted={isDeleted}
                  isEdited={isEdited}
                  isCurrentlyEditing={
                    editorState?.mode === 'edit' &&
                    (editorState as { wireId: string }).wireId === wire.wireId
                  }
                  extractedFrom={extractedConnectivity?.wires.find(w => w.wireId === wire.wireId) ?? null}
                  onEdit={() => openEditForm(wire)}
                  onDelete={() => handleDelete(wire.wireId)}
                  onUndoDelete={() => onDeleteWire(`__undo__${wire.wireId}`)}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Footer: decision detail */}
      {effectiveModel && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 text-[10px] text-gray-500 flex flex-wrap gap-3">
          <span>Readiness: <strong className="text-gray-700">{effectiveModel.decision.readinessScore}%</strong></span>
          <span>Unresolved: <strong className={effectiveModel.connectivity.unresolvedWires.length > 0 ? 'text-red-600' : 'text-gray-700'}>
            {effectiveModel.connectivity.unresolvedWires.length}
          </strong></span>
          {effectiveModel.decision.blockedWires.length > 0 && (
            <span className="text-red-600 font-semibold">Blocked wires: {effectiveModel.decision.blockedWires.join(', ')}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AddedWireRow({
  wire,
  onEdit,
  onDelete,
}: {
  wire: OperatorWireModel;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-[3rem_5rem_3rem_3rem_6rem_1rem_6rem_5rem_auto] gap-x-2 items-center px-4 py-1.5 border-b border-blue-100 bg-blue-50/20 hover:bg-blue-50/40">
      <span className="font-mono font-bold text-blue-700 text-[11px]">{wire.wireId}</span>
      <span className="font-mono text-[11px] text-blue-600">{wire.length != null ? `${wire.length} in` : dash}</span>
      <span className="font-mono text-[11px] text-gray-500">{wire.gauge ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-500">{wire.color ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-600 truncate" title={wire.from.component ?? ''}>{wire.from.component ?? dash}</span>
      <span className="text-gray-300 text-[11px]">→</span>
      <span className="font-mono text-[11px] text-gray-600 truncate" title={wire.to.component ?? ''}>{wire.to.component ?? dash}</span>
      <span className="inline-flex items-center gap-0.5">
        <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-semibold">Added by Operator</span>
      </span>
      <span className="flex gap-1 justify-end">
        <button type="button" onClick={onEdit}
          className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-600 hover:bg-gray-100">Edit</button>
        <button type="button" onClick={onDelete}
          className="px-2 py-0.5 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
      </span>
    </div>
  );
}

function ExtractedWireRow({
  wire,
  isDeleted,
  isEdited,
  isCurrentlyEditing,
  extractedFrom,
  onEdit,
  onDelete,
  onUndoDelete,
}: {
  wire: WireConnectivity;
  isDeleted: boolean;
  isEdited: boolean;
  isCurrentlyEditing: boolean;
  extractedFrom: WireConnectivity | null;
  onEdit: () => void;
  onDelete: () => void;
  onUndoDelete: () => void;
}) {
  const lengthDisplay = wire.lengthInches != null
    ? `${wire.lengthInches} in`
    : wire.length != null ? `${wire.length}` : dash;

  const rowCls = isDeleted
    ? 'opacity-40 line-through bg-red-50/40'
    : isEdited
      ? 'bg-amber-50/30'
      : isCurrentlyEditing
        ? 'bg-blue-50/40 ring-1 ring-inset ring-blue-300'
        : wire.unresolved
          ? 'bg-amber-50/20'
          : '';

  const showExtractedDiff = isEdited && extractedFrom && (
    extractedFrom.from.component !== wire.from.component ||
    extractedFrom.to.component !== wire.to.component
  );

  return (
    <div className={`grid grid-cols-[3rem_5rem_3rem_3rem_6rem_1rem_6rem_5rem_auto] gap-x-2 items-start px-4 py-1.5 border-b border-gray-100 hover:bg-gray-50/70 transition ${rowCls}`}>
      <span className="font-mono font-semibold text-gray-800 text-[11px] pt-0.5">{wire.wireId}</span>
      <span className="font-mono text-[11px] text-gray-600 pt-0.5">{lengthDisplay}</span>
      <span className="font-mono text-[11px] text-gray-500 pt-0.5">{wire.gauge ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-500 pt-0.5">{wire.color ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-600 truncate pt-0.5" title={wire.from.component ?? ''}>{wire.from.component ?? dash}</span>
      <span className="text-gray-300 text-[11px] pt-0.5">→</span>
      <span className="font-mono text-[11px] text-gray-600 truncate pt-0.5" title={wire.to.component ?? ''}>{wire.to.component ?? dash}</span>
      <span className="flex flex-wrap gap-0.5 items-start pt-0.5">
        {isDeleted && (
          <span className="rounded-full bg-red-100 text-red-700 px-1.5 py-0.5 text-[9px] font-semibold">Deleted</span>
        )}
        {isEdited && !isDeleted && (
          <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[9px] font-semibold">Edited by Operator</span>
        )}
        {wire.unresolved && !isDeleted && (
          <span className="rounded-full bg-orange-100 text-orange-700 px-1.5 py-0.5 text-[9px] font-semibold">Unresolved</span>
        )}
        {showExtractedDiff && (
          <span className="text-[9px] text-gray-400 block leading-tight" title={`Original: ${extractedFrom?.from.component ?? '?'} → ${extractedFrom?.to.component ?? '?'}`}>
            was: {extractedFrom?.from.component ?? '?'} → {extractedFrom?.to.component ?? '?'}
          </span>
        )}
      </span>
      <span className="flex gap-1 justify-end pt-0.5">
        {isDeleted ? (
          <button type="button" onClick={onUndoDelete}
            className="px-2 py-0.5 text-[10px] rounded border border-amber-200 text-amber-700 hover:bg-amber-50">Restore</button>
        ) : (
          <>
            <button type="button" onClick={onEdit}
              className="px-2 py-0.5 text-[10px] rounded border border-gray-200 text-gray-600 hover:bg-gray-100">Edit</button>
            <button type="button" onClick={onDelete}
              className="px-2 py-0.5 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
          </>
        )}
      </span>
    </div>
  );
}
