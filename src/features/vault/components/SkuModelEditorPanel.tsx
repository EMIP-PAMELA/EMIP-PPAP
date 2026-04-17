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

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type {
  HarnessConnectivityResult,
  WireConnectivity,
  EndpointTerminationType,
} from '@/src/features/harness-work-instructions/services/harnessConnectivityService';
import type {
  OperatorWireModel,
  WireTopology,
  OperatorWireBranch,
  AddedWireKind,
  SharedNodeInput,
} from '@/src/features/harness-work-instructions/services/skuModelEditService';
import {
  makeEmptyOperatorWire,
  wireConnectivityToOperatorModel,
  addedWireKindToTopology,
} from '@/src/features/harness-work-instructions/services/skuModelEditService';
import type { HarnessDecisionResult } from '@/src/features/harness-work-instructions/services/harnessDecisionService';
import type { WireIdentityResult } from '@/src/features/harness-work-instructions/services/wireIdentityService';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type SkuModelDeleteRequest =
  | { scope: 'operator'; operatorId: string }
  | { scope: 'extracted'; wireId: string; undo?: boolean };

/**
 * T14.5: External editor request — fired by graph interaction layer.
 * Consumed by useEffect inside SkuModelEditorPanel; clears itself after opening.
 */
export type ExternalEditorRequest =
  | { type: 'add';    prefill: { fromComponent?: string; fromCavity?: string; fromTermination?: EndpointTerminationType; topology?: WireTopology; branchSrcComp?: string; branchSrcCav?: string } }
  | { type: 'edit';   wireId: string }
  | { type: 'branch'; wireIds: string[]; fromComponent: string; fromCavity: string };

export interface SkuModelEditorPanelProps {
  extractedConnectivity: HarnessConnectivityResult | null;
  /** T12.4 effective connectivity (T11 overrides + T12 SKU edits applied). */
  effectiveConnectivity: HarnessConnectivityResult | null;
  /** T12.4 effective decision recomputed from effective connectivity. */
  effectiveDecision: HarnessDecisionResult | null;
  operatorAddedWires: OperatorWireModel[];
  operatorEditedWires: OperatorWireModel[];
  operatorDeletedWireIds: string[];
  onAddWire: (wire: OperatorWireModel) => void;
  onEditWire: (wire: OperatorWireModel) => void;
  onDeleteWire: (request: SkuModelDeleteRequest) => void;
  /** T14.5: Optional external request to open the editor from the graph. */
  externalEditorRequest?: ExternalEditorRequest | null;
  /** T14.5: Called once the external request has been consumed (to clear parent state). */
  onExternalRequestConsumed?: () => void;
  /** T15: Wire identity assignments — shows internalWireId (read-only) alongside each wire. */
  wireIdentities?: WireIdentityResult | null;
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

const TERMINATION_LABELS: Record<EndpointTerminationType, string> = {
  UNKNOWN:          'Unknown / Not specified',
  CONNECTOR_PIN:    'Connector pin',
  TERMINAL:         'Terminal / component',
  FERRULE:          'Ferrule',
  STRIP_ONLY:       'Strip-only',
  SPLICE:           'Splice',
  GROUND:           'Ground',
  RING:             'Ring terminal',
  SPADE:            'Spade terminal',
  RECEPTACLE:       'Receptacle',
  OTHER_TREATMENT:  'Other treatment',
};

const TERMINATION_OPTIONS: { value: EndpointTerminationType | ''; label: string }[] = [
  { value: '', label: '— Select termination —' },
  ...Object.entries(TERMINATION_LABELS).map(([value, label]) => ({ value: value as EndpointTerminationType, label })),
];

type AnyEndpoint = {
  component: string | null;
  cavity: string | null;
  treatment: string | null;
  terminationType?: EndpointTerminationType | null;
};

function humanizeTermination(type?: EndpointTerminationType | null): string | null {
  if (!type || type === 'UNKNOWN') return null;
  return TERMINATION_LABELS[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase());
}

function describeTermination(endpoint: AnyEndpoint): string | null {
  const label = humanizeTermination(endpoint.terminationType ?? null);
  if (!label) return endpoint.treatment?.trim() || null;
  const treatment = endpoint.treatment?.trim();
  return treatment ? `${label} (${treatment})` : label;
}

function endpointDisplay(endpoint: AnyEndpoint): string {
  const component = endpoint.component?.trim() ?? '';
  const cavity    = endpoint.cavity?.trim() ?? '';
  if (component && cavity) return `${component}:${cavity}`;
  if (component) return component;
  if (cavity) return `:${cavity}`;
  return describeTermination(endpoint) ?? dash;
}

function defaultTerminationValue(endpoint?: AnyEndpoint | null): EndpointTerminationType | '' {
  if (!endpoint) return '';
  if (endpoint.terminationType && endpoint.terminationType !== 'UNKNOWN') return endpoint.terminationType;
  if (endpoint.component && endpoint.cavity) return 'CONNECTOR_PIN';
  return '';
}

function formatWireLabel(label?: string | null): string {
  if (!label || !label.trim()) return 'Wire (no ID)';
  return label.trim();
}

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
  fromTermination: EndpointTerminationType | '';
  fromPartNumber: string;
  fromStripLength: string;
  toComponent: string;
  toCavity: string;
  toTreatment: string;
  toTermination: EndpointTerminationType | '';
  toPartNumber: string;
  toStripLength: string;
  topology: WireTopology | '';
  branchSrcComp: string;
  branchSrcCav: string;
  branchSecCav: string;
  branchFerrulePN: string;
  branchTerminalPN: string;
  branchAci: string;
  reason: string;
}

type WireFormView = WireFormState & {
  to: {
    component: string;
    cavity: string;
    treatment: string;
    termination: EndpointTerminationType | '';
    partNumber: string;
    stripLength: string;
  };
};

function emptyForm(): WireFormState {
  return {
    wireId: '', length: '', gauge: '', color: '',
    fromComponent: '', fromCavity: '', fromTreatment: '', fromTermination: '',
    fromPartNumber: '', fromStripLength: '',
    toComponent: '', toCavity: '', toTreatment: '', toTermination: '',
    toPartNumber: '', toStripLength: '',
    topology: '', branchSrcComp: '', branchSrcCav: '', branchSecCav: '',
    branchFerrulePN: '', branchTerminalPN: '', branchAci: '', reason: '',
  };
}

function wireToForm(wire: WireConnectivity | OperatorWireModel): WireFormState {
  const from = wire.from;
  const to   = wire.to;
  const isOp = (wire as OperatorWireModel).source === 'OPERATOR_MODEL';
  const opWire = isOp ? (wire as OperatorWireModel) : null;

  const branch: OperatorWireBranch | null = opWire?.branch ?? null;

  return {
    wireId:         wire.wireId ?? '',
    length:         wire.length != null ? String(wire.length) : '',
    gauge:          wire.gauge ?? '',
    color:          wire.color ?? '',
    fromComponent:  from.component ?? '',
    fromCavity:     from.cavity    ?? '',
    fromTreatment:  from.treatment ?? '',
    fromTermination: defaultTerminationValue(from),
    fromPartNumber:  from.partNumber  ?? '',
    fromStripLength: from.stripLength ?? '',
    toComponent:    to.component   ?? '',
    toCavity:       to.cavity      ?? '',
    toTreatment:    to.treatment   ?? '',
    toTermination:  defaultTerminationValue(to),
    toPartNumber:   to.partNumber  ?? '',
    toStripLength:  to.stripLength ?? '',
    topology:       opWire?.topology ?? '',
    branchSrcComp:  branch?.sharedSourceComponent  ?? '',
    branchSrcCav:   branch?.sharedSourceCavity     ?? '',
    branchSecCav:   branch?.secondaryCavity        ?? '',
    branchFerrulePN:  branch?.ferrulePartNumber    ?? '',
    branchTerminalPN: branch?.terminalPartNumber   ?? '',
    branchAci:        branch?.sharedAci            ?? '',
    reason:         opWire?.reason ?? '',
  };
}

function formToOperatorWire(
  form: WireFormState,
  existingId?: string,
  existingCreatedAt?: string,
  targetWireId?: string | null,
): OperatorWireModel {
  const now = new Date().toISOString();
  const topology = (form.topology || null) as WireTopology | null;
  const needsBranch = topology === 'BRANCH_DOUBLE_CRIMP' || topology === 'SPLICE';
  const trimmedBranchSrcComp   = form.branchSrcComp.trim();
  const trimmedBranchSrcCav    = form.branchSrcCav.trim();
  const trimmedBranchSecCav    = form.branchSecCav.trim();
  const trimmedBranchFerrulePN = form.branchFerrulePN.trim();
  const trimmedBranchTerminal  = form.branchTerminalPN.trim();
  const trimmedBranchAci       = form.branchAci.trim();
  const branch: OperatorWireBranch | null = needsBranch
    ? {
        sharedSourceComponent:  trimmedBranchSrcComp   || null,
        sharedSourceCavity:     trimmedBranchSrcCav    || null,
        secondaryCavity:        trimmedBranchSecCav    || null,
        ferrulePartNumber:      trimmedBranchFerrulePN || null,
        terminalPartNumber:     trimmedBranchTerminal  || null,
        sharedAci:              trimmedBranchAci       || null,
      }
    : null;
  const trimmedWireId = form.wireId.trim();
  const sanitizedWireId = trimmedWireId.length > 0 ? trimmedWireId : null;
  const fromTermination = (form.fromTermination || null) as EndpointTerminationType | null;
  const toTermination = (form.toTermination || null) as EndpointTerminationType | null;
  const fromComponent = form.fromComponent.trim();
  const fromCavity    = form.fromCavity.trim();
  const fromTreatment = (form.fromTreatment ?? '').trim();
  const toComponent   = (form.toComponent ?? '').trim();
  const rawToCavity   = form.toCavity;
  let toCavity        = rawToCavity !== undefined && rawToCavity !== null
    ? String(rawToCavity).trim()
    : '';
  const toTreatment   = (form.toTreatment ?? '').trim();
  const sameComponent = Boolean(
    fromComponent &&
    toComponent &&
    fromComponent.toLowerCase() === toComponent.toLowerCase(),
  );

  if (sameComponent && !toCavity && trimmedBranchSecCav) {
    toCavity = trimmedBranchSecCav;
    console.log('[T23.6.6 SAME COMPONENT CAVITY PROMOTION]', {
      wireId: sanitizedWireId,
      branchSecondaryCavity: trimmedBranchSecCav,
    });
  }

  if (toComponent && !toCavity) {
    console.error('[T23.6.4.4 ERROR] Missing TO cavity for connector endpoint', {
      toComponent,
      form,
    });
  }

  const operatorWire: OperatorWireModel = {
    id:          existingId ?? `op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    wireId:      sanitizedWireId,
    targetWireId: targetWireId ?? sanitizedWireId,
    length:      form.length !== '' ? parseFloat(form.length) : null,
    lengthUnit:  'in',
    gauge:       form.gauge.trim() || null,
    color:       form.color.trim() || null,
    from: {
      component:       fromComponent || null,
      cavity:          fromCavity || null,
      treatment:       fromTreatment || null,
      terminationType: fromTermination,
      partNumber:      form.fromPartNumber.trim()  || null,
      stripLength:     form.fromStripLength.trim() || null,
      processSource:   (form.fromPartNumber.trim() || form.fromStripLength.trim()) ? 'OPERATOR' : undefined,
    },
    to: {
      component:       toComponent || null,
      cavity:          toCavity !== '' ? toCavity : null,
      treatment:       toTreatment || null,
      terminationType: toTermination,
      partNumber:      form.toPartNumber.trim()    || null,
      stripLength:     form.toStripLength.trim()   || null,
      processSource:   (form.toPartNumber.trim() || form.toStripLength.trim()) ? 'OPERATOR' : undefined,
    },
    topology,
    branch,
    reason:      form.reason.trim(),
    source:      'OPERATOR_MODEL',
    authoritative: true,
    createdAt:   existingCreatedAt ?? now,
    updatedAt:   now,
  };

  if (sameComponent) {
    console.log('[T23.6.6 SAME COMPONENT WIRE]', {
      wireId: operatorWire.wireId ?? operatorWire.id,
      from: operatorWire.from,
      to: operatorWire.to,
    });
  }

  return operatorWire;
}

// ---------------------------------------------------------------------------
// Wire editor form component
// ---------------------------------------------------------------------------

interface WireEditorProps {
  initialForm: WireFormState;
  existingId?: string;
  existingCreatedAt?: string;
  targetWireId?: string | null;
  mode: 'add' | 'edit';
  onSave: (wire: OperatorWireModel) => void;
  onCancel: () => void;
  wizardContext?: {
    addedWireKind: AddedWireKind;
    sharedNode?: SharedNodeInput;
  };
}

function WireEditorForm({
  initialForm,
  existingId,
  existingCreatedAt,
  targetWireId,
  mode,
  onSave,
  onCancel,
  wizardContext,
}: WireEditorProps) {
  const [formState, setForm] = useState<WireFormState>(initialForm);
  const [errors, setErrors] = useState<Partial<Record<keyof WireFormState | 'fromTermination' | 'toTermination', string>>>({});
  const userEditedToRef = useRef({
    component: Boolean(initialForm.toComponent?.trim()),
    cavity:    Boolean(initialForm.toCavity?.trim()),
  });

  const form = useMemo<WireFormView>(() => ({
    ...formState,
    to: {
      component: formState.toComponent,
      cavity: formState.toCavity,
      treatment: formState.toTreatment,
      termination: formState.toTermination,
      partNumber: formState.toPartNumber,
      stripLength: formState.toStripLength,
    },
  }), [formState]);

  const set = (key: keyof WireFormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    if (key === 'toComponent') userEditedToRef.current.component = true;
    if (key === 'toCavity')    userEditedToRef.current.cavity    = true;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const wizardKind = wizardContext?.addedWireKind;
  const sharedNode = wizardContext?.sharedNode;
  const isWizardAddFlow = mode === 'add' && Boolean(wizardKind);
  const isSharedNodeWizard = Boolean(isWizardAddFlow && wizardKind && wizardKind !== 'STANDALONE');
  const isFerruleKind = wizardKind === 'DOUBLE_CRIMP_FERRULE' || wizardKind === 'MACHINE_CRIMP_BAND';
  const isTerminalDoubleCrimp = wizardKind === 'DOUBLE_CRIMP_TERMINAL';
  const lockedFromTermination: EndpointTerminationType | null = isFerruleKind
    ? 'FERRULE'
    : isTerminalDoubleCrimp
      ? 'TERMINAL'
      : wizardKind === 'SPLICE'
        ? 'SPLICE'
        : null;
  const lockedTopology = wizardKind ? addedWireKindToTopology(wizardKind) : null;
  const sharedHardwareLabel = wizardKind && wizardKind !== 'STANDALONE'
    ? KIND_HW_PN_LABEL[wizardKind]
    : 'Shared hardware PN';
  const sharedNodeLabel = wizardKind && wizardKind !== 'STANDALONE'
    ? KIND_SHARED_NODE_LABEL[wizardKind]
    : null;
  const lockedSharedPartNumber = sharedNode?.sharedPartNumber?.trim() ?? '';

  useEffect(() => {
    if (!isWizardAddFlow || !wizardKind) return;
    setForm(prev => {
      const updates: Partial<WireFormState> = {};
      if (sharedNode?.sharedComponent && prev.fromComponent !== sharedNode.sharedComponent) {
        updates.fromComponent = sharedNode.sharedComponent;
      }
      if (sharedNode?.sharedCavity && prev.fromCavity !== sharedNode.sharedCavity) {
        updates.fromCavity = sharedNode.sharedCavity;
      }
      if (lockedTopology && prev.topology !== lockedTopology) {
        updates.topology = lockedTopology;
      }
      if (lockedFromTermination && prev.fromTermination !== lockedFromTermination) {
        updates.fromTermination = lockedFromTermination;
      }
      if (sharedNode?.sharedAci && prev.branchAci !== sharedNode.sharedAci) {
        updates.branchAci = sharedNode.sharedAci;
      }
      if (lockedSharedPartNumber) {
        if (isFerruleKind && prev.branchFerrulePN !== lockedSharedPartNumber) {
          updates.branchFerrulePN = lockedSharedPartNumber;
        }
        if (isTerminalDoubleCrimp && prev.branchTerminalPN !== lockedSharedPartNumber) {
          updates.branchTerminalPN = lockedSharedPartNumber;
        }
      }
      // T23.6.4.2: never let wizard/shared-node automation clobber operator-entered TO fields.
      if ('toComponent' in updates && userEditedToRef.current.component) delete updates.toComponent;
      if ('toCavity' in updates && userEditedToRef.current.cavity)       delete updates.toCavity;

      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [isWizardAddFlow, wizardKind, sharedNode, lockedTopology, lockedFromTermination, isFerruleKind, isTerminalDoubleCrimp, lockedSharedPartNumber]);

  const validate = (): boolean => {
    const errs: typeof errors = {};
    if (!form.reason.trim()) errs.reason = 'Reason is required';
    const fromHasComponent = Boolean(form.fromComponent.trim()) && Boolean(form.fromCavity.trim());
    const fromTerminationSelected = form.fromTermination && form.fromTermination !== 'UNKNOWN';
    if (!fromHasComponent && !fromTerminationSelected) {
      errs.fromComponent = 'Provide connector/pin or termination type';
      errs.fromTermination = 'Select a termination type if no connector';
    }
    if (form.fromTermination === 'CONNECTOR_PIN') {
      if (!form.fromComponent.trim()) errs.fromComponent = 'Component is required for connector pin';
      if (!form.fromCavity.trim()) errs.fromCavity = 'Cavity is required for connector pin';
    }
    const hasToComponent = Boolean(form.toComponent.trim());
    const hasTerminal = Boolean(form.branchTerminalPN.trim());
    const toTerminationSelected = form.toTermination && form.toTermination !== 'UNKNOWN';
    if (!hasToComponent && !hasTerminal && !toTerminationSelected) {
      errs.toComponent = 'Provide component, terminal PN, or termination type';
      errs.toTermination = 'Select termination if no component/terminal PN';
    }
    if (form.toTermination === 'CONNECTOR_PIN') {
      if (!form.toComponent.trim()) errs.toComponent = 'Component is required for connector pin';
      if (!form.toCavity.trim()) errs.toCavity = 'Cavity is required for connector pin';
    }
    if (form.length !== '' && isNaN(parseFloat(form.length))) errs.length = 'Must be a number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    const trimmedFromComponent = form.fromComponent.trim();
    const trimmedFromCavity = form.fromCavity.trim();
    const trimmedToComponent = form.to.component?.trim() ?? '';
    const trimmedToCavity = form.to.cavity?.trim() ?? '';
    const lowerComponent = trimmedToComponent.toLowerCase();
    const sameComponent = Boolean(
      trimmedFromComponent &&
      trimmedToComponent &&
      trimmedFromComponent.toLowerCase() === trimmedToComponent.toLowerCase(),
    );

    if (sameComponent && !trimmedToCavity) {
      console.error('[T23.6.6 INVALID SAME COMPONENT WIRE]', {
        wireId: form.wireId || null,
        from: {
          component: trimmedFromComponent || null,
          cavity: trimmedFromCavity || null,
        },
        to: {
          component: trimmedToComponent || null,
          cavity: trimmedToCavity || null,
        },
      });
    }
    if (trimmedToComponent && lowerComponent.includes('phoenix') && !trimmedToCavity) {
      console.error('[T23.6.4.4 VALIDATION] Missing TO cavity for Phoenix connector', form);
      if (typeof window !== 'undefined') {
        window.alert('Connector pin (TO cavity) is required for this Phoenix connector.');
      }
      return;
    }
    if (!trimmedToCavity) {
      console.error('[T23.6.4.3 VALIDATION] Missing TO cavity', form);
      if (typeof window !== 'undefined') {
        window.alert('TO pin (cavity) is required for this wire.');
      }
      return;
    }
    console.log('[T23.6.4.1 SAVE]', {
      mode,
      wireId:         form.wireId,
      toComponent:    form.to.component,
      toCavity:       form.to.cavity,
      fromComponent:  form.fromComponent,
      fromCavity:     form.fromCavity,
      topology:       form.topology,
      branchSecCav:   form.branchSecCav,
    });
    console.log('[T23.6.4.2 FINAL FORM]', {
      toComponent: form.to.component,
      toCavity:    form.to.cavity,
      wizardKind,
      userEditedTo: userEditedToRef.current,
    });
    const operatorWire = formToOperatorWire(form, existingId, existingCreatedAt, targetWireId ?? null);
    console.log('[T23.6.4.1 MODEL]', {
      operatorId:     operatorWire.id,
      targetWireId:   operatorWire.targetWireId,
      toEndpoint:     operatorWire.to,
      fromEndpoint:   operatorWire.from,
      topology:       operatorWire.topology,
    });
    console.log('[T23.6.7 SAVE CHECK]', {
      wireId: (operatorWire as any)?.internalWireId || operatorWire.id,
      finalForm: {
        toComponent: form.toComponent,
        toCavity:    form.toCavity,
      },
      persistedModel: {
        toComponent: operatorWire.to?.component ?? null,
        toCavity:    operatorWire.to?.cavity ?? null,
      },
    });
    console.log('[T23.6.4.3 VERIFY]', {
      finalFormToCavity: form.to.cavity,
      modelToCavity: operatorWire.to?.cavity ?? null,
    });
    onSave(operatorWire);
  };

  const labelCls = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide';
  const inputCls = (err?: string) =>
    `w-full rounded border ${err ? 'border-red-400 bg-red-50' : 'border-[color:var(--panel-border)] bg-[color:var(--input-bg)]'} px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400`;
  const helperCls = 'text-[10px] text-gray-500 mt-0.5';
  const lockedPillCls = 'inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600';

  const renderLockedValue = (label: string, value: string | null, helper?: string) => (
    <div>
      <p className={labelCls}>{label}</p>
      <p className="text-[12px] font-semibold text-[color:var(--text-primary)]">{value?.trim() || dash}</p>
      {helper && <p className={helperCls}>{helper}</p>}
    </div>
  );

  const topologyLabel = form.topology
    ? TOPOLOGY_OPTIONS.find(o => o.value === form.topology)?.label ?? form.topology
    : '— Standard (unspecified) —';

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-blue-700">
          {mode === 'add' ? '+ Add Wire' : `Edit Wire: ${formatWireLabel(initialForm.wireId)}`}
        </p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-[11px]">
          Cancel
        </button>
      </div>

      {/* Identity */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={labelCls}>Customer Wire Label (printed on wire)</label>
          <input
            value={form.wireId}
            onChange={set('wireId')}
            className={inputCls()}
            placeholder="e.g. COM, W1"
          />
          <p className={helperCls}>This is the label printed on the wire. The system assigns internal IDs automatically.</p>
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
        <p className={`${labelCls} text-teal-700 mb-1 flex items-center justify-between`}>
          FROM endpoint
          {isSharedNodeWizard && sharedNodeLabel && (
            <span className={lockedPillCls}>Locked · {sharedNodeLabel}</span>
          )}
        </p>
        {isSharedNodeWizard ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {renderLockedValue('Component', form.fromComponent || sharedNode?.sharedComponent || null)}
              {renderLockedValue('Cavity / Pin', form.fromCavity || sharedNode?.sharedCavity || null)}
            </div>
            {lockedFromTermination && (
              <p className={helperCls}>
                Termination type: <span className="font-semibold text-[color:var(--text-primary)]">{humanizeTermination(lockedFromTermination) ?? lockedFromTermination}</span>
              </p>
            )}
            <p className={helperCls}>Edit shared-node details by returning to Step 2.</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <label className={labelCls}>Strip Length <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <input value={form.fromStripLength} onChange={set('fromStripLength')} className={inputCls()} placeholder="e.g. 8.5 mm" />
              </div>
              {!isWizardAddFlow && (
                <div>
                  <label className={labelCls}>Connection Method</label>
                  <input value={form.fromTreatment} onChange={set('fromTreatment')} className={inputCls()} placeholder="SPLICE…" />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5">
            <div>
              <label className={labelCls}>Component *</label>
              <input value={form.fromComponent} onChange={set('fromComponent')} className={inputCls(errors.fromComponent)} placeholder="J1" />
              {errors.fromComponent && <p className="text-[10px] text-red-600 mt-0.5">{errors.fromComponent}</p>}
            </div>
            <div>
              <label className={labelCls}>Cavity / Pin *</label>
              <input value={form.fromCavity} onChange={set('fromCavity')} className={inputCls(errors.fromCavity)} placeholder="1" />
              {errors.fromCavity && <p className="text-[10px] text-red-600 mt-0.5">{errors.fromCavity}</p>}
            </div>
            <div>
              <label className={labelCls}>Connection Method</label>
              <input value={form.fromTreatment} onChange={set('fromTreatment')} className={inputCls()} placeholder="SPLICE…" />
            </div>
            <div className="col-span-3">
              <label className={labelCls}>Termination Type</label>
              <select value={form.fromTermination} onChange={set('fromTermination')} className={inputCls(errors.fromTermination)}>
                {TERMINATION_OPTIONS.map(opt => (
                  <option key={opt.value ?? 'blank'} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {errors.fromTermination && <p className="text-[10px] text-red-600 mt-0.5">{errors.fromTermination}</p>}
            </div>
            {!isWizardAddFlow && (
              <>
                <div>
                  <label className={labelCls}>Part Number <span className="text-gray-400 normal-case font-normal">(Komax)</span></label>
                  <input value={form.fromPartNumber} onChange={set('fromPartNumber')} className={inputCls()} placeholder="e.g. 929504-1" />
                </div>
                <div>
                  <label className={labelCls}>Strip Length <span className="text-gray-400 normal-case font-normal">(Komax)</span></label>
                  <input value={form.fromStripLength} onChange={set('fromStripLength')} className={inputCls()} placeholder="e.g. 8.5 mm" />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* TO endpoint */}
      <div>
        <p className={`${labelCls} text-indigo-700 mb-1`}>TO endpoint</p>
        <div className="grid grid-cols-3 gap-1.5">
          <div>
            <label className={labelCls}>Component / Terminal PN</label>
            <input value={form.toComponent} onChange={set('toComponent')} className={inputCls(errors.toComponent)} placeholder="929504-1" />
            {errors.toComponent && <p className="text-[10px] text-red-600 mt-0.5">{errors.toComponent}</p>}
          </div>
          <div>
            <label className={labelCls}>Cavity</label>
            <input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              pattern="[0-9]*"
              value={form.to.cavity}
              onChange={set('toCavity')}
              className={inputCls()}
              placeholder=""
            />
          </div>
          <div>
            <label className={labelCls}>Connection Method</label>
            <input value={form.toTreatment} onChange={set('toTreatment')} className={inputCls()} placeholder="" />
          </div>
          <div className="col-span-3">
            <label className={labelCls}>Termination Type</label>
            <select value={form.toTermination} onChange={set('toTermination')} className={inputCls(errors.toTermination)}>
              {TERMINATION_OPTIONS.map(opt => (
                <option key={opt.value ?? 'blank'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {errors.toTermination && <p className="text-[10px] text-red-600 mt-0.5">{errors.toTermination}</p>}
          </div>
          {!isWizardAddFlow && (
            <>
              <div>
                <label className={labelCls}>Part Number <span className="text-gray-400 normal-case font-normal">(Komax)</span></label>
                <input value={form.toPartNumber} onChange={set('toPartNumber')} className={inputCls()} placeholder="e.g. 929504-1" />
              </div>
              <div>
                <label className={labelCls}>Strip Length <span className="text-gray-400 normal-case font-normal">(Komax)</span></label>
                <input value={form.toStripLength} onChange={set('toStripLength')} className={inputCls()} placeholder="e.g. 8.5 mm" />
              </div>
            </>
          )}
          {isWizardAddFlow && (
            <div>
              <label className={labelCls}>Strip Length <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
              <input value={form.toStripLength} onChange={set('toStripLength')} className={inputCls()} placeholder="e.g. 8.5 mm" />
            </div>
          )}
        </div>
      </div>

      {/* Topology */}
      <div>
        <label className={labelCls}>Topology</label>
        {isWizardAddFlow && lockedTopology ? (
          <div className="rounded border border-dashed border-slate-200 bg-white px-2 py-1 text-[12px] text-[color:var(--text-primary)]">
            {topologyLabel}
            <p className={helperCls}>Wizard selections lock the topology. Use Step 1 to change the wire kind.</p>
          </div>
        ) : (
          <select value={form.topology} onChange={set('topology')} className={inputCls()}>
            <option value="">— Standard (unspecified) —</option>
            {TOPOLOGY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Branch / Double-Crimp / Splice shared-node fields */}
      {(form.topology === 'BRANCH_DOUBLE_CRIMP' || form.topology === 'SPLICE') && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2 space-y-2">
          <p className={`${labelCls} text-amber-700`}>
            {form.topology === 'SPLICE' ? 'Splice / Shared-node data' : 'Branch / Double-Crimp data'}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {isSharedNodeWizard ? (
              <>
                {renderLockedValue('Shared Source Component', form.branchSrcComp || sharedNode?.sharedComponent || null)}
                {renderLockedValue('Shared Source Cavity', form.branchSrcCav || sharedNode?.sharedCavity || null)}
              </>
            ) : (
              <>
                <div>
                  <label className={labelCls}>Shared Source Component</label>
                  <input value={form.branchSrcComp} onChange={set('branchSrcComp')} className={inputCls()} placeholder="PHOENIX 1700443" />
                </div>
                <div>
                  <label className={labelCls}>Shared Source Cavity</label>
                  <input value={form.branchSrcCav} onChange={set('branchSrcCav')} className={inputCls()} placeholder="2" />
                </div>
              </>
            )}
            <div>
              <label className={labelCls}>Secondary Cavity</label>
              <input value={form.branchSecCav} onChange={set('branchSecCav')} className={inputCls()} placeholder="5" />
            </div>
            {isFerruleKind && lockedSharedPartNumber ? (
              renderLockedValue(sharedHardwareLabel, form.branchFerrulePN || lockedSharedPartNumber, 'Captured in Shared Node step')
            ) : (
              <div>
                <label className={labelCls}>Ferrule PN</label>
                <input value={form.branchFerrulePN} onChange={set('branchFerrulePN')} className={inputCls()} placeholder="1381010" />
              </div>
            )}
            {isTerminalDoubleCrimp && lockedSharedPartNumber ? (
              renderLockedValue(sharedHardwareLabel, form.branchTerminalPN || lockedSharedPartNumber, 'Captured in Shared Node step')
            ) : (
              <div>
                <label className={labelCls}>Terminal PN</label>
                <input value={form.branchTerminalPN} onChange={set('branchTerminalPN')} className={inputCls()} placeholder="61944-1" />
              </div>
            )}
            {isSharedNodeWizard && sharedNode?.sharedAci ? (
              renderLockedValue('Hardware ACI', sharedNode.sharedAci, 'Provided in Shared Node step')
            ) : (
              <div>
                <label className={labelCls}>Hardware ACI <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <input value={form.branchAci} onChange={set('branchAci')} className={inputCls()} placeholder="e.g. ACI10898" />
              </div>
            )}
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
          className={`w-full rounded border ${errors.reason ? 'border-red-400 bg-red-50' : 'border-[color:var(--panel-border)] bg-[color:var(--input-bg)]'} px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none`}
          placeholder="Explain why this wire is being added / changed…"
        />
        {errors.reason && <p className="text-[10px] text-red-600 mt-0.5">{errors.reason}</p>}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="px-3 py-1 text-[12px] rounded border border-[color:var(--panel-border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-elevated)]">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!form.to.cavity?.trim()}
          className={`px-3 py-1 text-[12px] rounded font-semibold text-white ${!form.to.cavity?.trim()
            ? 'bg-blue-300 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700'
          }`}>
          {mode === 'add' ? 'Add Wire' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// T23: Add-wire wizard sub-components
// ---------------------------------------------------------------------------

/** Data collected in wizard step 2 (shared-node details). */
interface SharedNodeStepData {
  sharedComp: string;
  sharedCav: string;
  hardwarePN: string;
  hardwareAci: string;
}

const KIND_WIZARD_OPTIONS: { value: AddedWireKind; label: string; desc: string }[] = [
  { value: 'STANDALONE',            label: 'Standalone wire',         desc: 'Point-to-point — no shared hardware' },
  { value: 'DOUBLE_CRIMP_TERMINAL', label: 'Double-crimp in terminal', desc: 'Two wires share a crimp terminal' },
  { value: 'DOUBLE_CRIMP_FERRULE',  label: 'Double-crimp in ferrule',  desc: 'Two wires share a ferrule (e.g. ACI10898)' },
  { value: 'MACHINE_CRIMP_BAND',    label: 'Machine crimp band',       desc: 'Multiple wires in a crimped band' },
  { value: 'SPLICE',                label: 'Splice / shared node',     desc: 'Wire connects at a splice point' },
];

const KIND_SHARED_NODE_LABEL: Record<Exclude<AddedWireKind, 'STANDALONE'>, string> = {
  DOUBLE_CRIMP_TERMINAL: 'terminal double-crimp',
  DOUBLE_CRIMP_FERRULE:  'ferrule double-crimp',
  MACHINE_CRIMP_BAND:    'machine crimp band',
  SPLICE:                'splice / shared node',
};

const KIND_HW_PN_LABEL: Record<Exclude<AddedWireKind, 'STANDALONE'>, string> = {
  DOUBLE_CRIMP_TERMINAL: 'Terminal part number',
  DOUBLE_CRIMP_FERRULE:  'Ferrule part number',
  MACHINE_CRIMP_BAND:    'Crimp band part number',
  SPLICE:                'Splice hardware PN',
};

function KindStepPanel({
  onKindSelected,
  onCancel,
}: {
  onKindSelected: (kind: AddedWireKind) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-blue-700">+ Add Wire — Step 1 of 3: Wire Kind</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-[11px]">Cancel</button>
      </div>
      <p className="text-[11px] font-semibold text-[color:var(--text-primary)]">What kind of wire are you adding?</p>
      <div className="space-y-1">
        {KIND_WIZARD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onKindSelected(opt.value)}
            className="w-full text-left px-3 py-2 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] hover:border-blue-400 hover:bg-blue-50/60 transition-colors"
          >
            <span className="text-[12px] font-semibold text-[color:var(--text-primary)]">{opt.label}</span>
            <span className="ml-2 text-[11px] text-[color:var(--text-secondary)]">{opt.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SharedNodeStepPanel({
  kind,
  prefillComp,
  prefillCav,
  onContinue,
  onBack,
  onCancel,
}: {
  kind: Exclude<AddedWireKind, 'STANDALONE'>;
  prefillComp?: string;
  prefillCav?: string;
  onContinue: (data: SharedNodeStepData) => void;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ sharedComp: prefillComp ?? '', sharedCav: prefillCav ?? '', hardwarePN: '', hardwareAci: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const handleContinue = () => {
    const errs: Record<string, string> = {};
    if (!form.sharedComp.trim()) errs.sharedComp = 'Required';
    if (!form.sharedCav.trim()) errs.sharedCav = 'Required';
    setErrors(errs);
    if (Object.keys(errs).length === 0) onContinue(form);
  };

  const lbl = 'text-[11px] font-semibold text-gray-500 uppercase tracking-wide';
  const inp = (err?: string) =>
    `w-full rounded border ${err ? 'border-red-400 bg-red-50' : 'border-[color:var(--panel-border)] bg-[color:var(--input-bg)]'} px-2 py-1 text-[12px] text-[color:var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-blue-400`;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-amber-700">+ Add Wire — Step 2 of 3: Shared Node</p>
        <button type="button" onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-[11px]">Cancel</button>
      </div>
      <p className="text-[11px] text-[color:var(--text-secondary)]">
        Node type: <span className="font-semibold text-amber-700">{KIND_SHARED_NODE_LABEL[kind]}</span>
        {' — '}Where is the shared crimp located?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={lbl}>Shared component *</label>
          <input value={form.sharedComp} onChange={set('sharedComp')} className={inp(errors.sharedComp)} placeholder="e.g. PHOENIX 1700443" />
          {errors.sharedComp && <p className="text-[10px] text-red-600 mt-0.5">{errors.sharedComp}</p>}
        </div>
        <div>
          <label className={lbl}>Shared cavity / pin *</label>
          <input value={form.sharedCav} onChange={set('sharedCav')} className={inp(errors.sharedCav)} placeholder="e.g. 2" />
          {errors.sharedCav && <p className="text-[10px] text-red-600 mt-0.5">{errors.sharedCav}</p>}
        </div>
        <div>
          <label className={lbl}>{KIND_HW_PN_LABEL[kind]}</label>
          <input value={form.hardwarePN} onChange={set('hardwarePN')} className={inp()} placeholder="e.g. 1381010" />
        </div>
        <div>
          <label className={lbl}>Hardware ACI <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
          <input value={form.hardwareAci} onChange={set('hardwareAci')} className={inp()} placeholder="e.g. ACI10898" />
        </div>
      </div>
      <div className="flex justify-between gap-2 pt-1">
        <button type="button" onClick={onBack}
          className="px-3 py-1 text-[12px] rounded border border-[color:var(--panel-border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-elevated)]">
          ← Back
        </button>
        <button type="button" onClick={handleContinue}
          className="px-3 py-1 text-[12px] rounded bg-blue-600 text-white hover:bg-blue-700 font-semibold">
          Next: Wire Details →
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
  effectiveConnectivity,
  effectiveDecision,
  operatorAddedWires,
  operatorEditedWires,
  operatorDeletedWireIds,
  onAddWire,
  onEditWire,
  onDeleteWire,
  externalEditorRequest,
  onExternalRequestConsumed,
  wireIdentities,
}: SkuModelEditorPanelProps) {
  const [editorState, setEditorState] = useState<
    | { mode: 'add'; step: 'kind';        graphPrefill?: { fromComponent?: string; fromCavity?: string } }
    | { mode: 'add'; step: 'shared-node'; kind: Exclude<AddedWireKind, 'STANDALONE'>; graphPrefill?: { fromComponent?: string; fromCavity?: string } }
    | { mode: 'add'; step: 'wire-form';   form: WireFormState; addedWireKind: AddedWireKind; sharedNode?: SharedNodeInput }
    | { mode: 'edit'; form: WireFormState; id: string; createdAt: string; targetWireId: string | null; isAddedWire: boolean }
    | null
  >(null);

  const deletedSet  = new Set(operatorDeletedWireIds);
  const editedMap   = new Map<string, OperatorWireModel>();
  for (const edit of operatorEditedWires) {
    const key = edit.targetWireId ?? edit.wireId ?? null;
    if (!key) continue;
    editedMap.set(key, edit);
  }
  const addedIdentity = (wire: OperatorWireModel) => wire.targetWireId ?? wire.wireId ?? wire.id;
  const addedMap    = new Map(operatorAddedWires.map(w => [addedIdentity(w), w]));

  const effectiveWires = effectiveConnectivity?.wires ?? extractedConnectivity?.wires ?? [];
  const overallDecision = effectiveDecision?.overallDecision ?? null;

  // Stable refs so the external-request useEffect never goes stale
  const effectiveWiresRef = useRef(effectiveWires);
  effectiveWiresRef.current = effectiveWires;
  const editedMapRef = useRef(editedMap);
  editedMapRef.current = editedMap;

  // T14.5: Consume external editor request from graph interaction
  useEffect(() => {
    if (!externalEditorRequest) return;

    if (externalEditorRequest.type === 'add') {
      const p = externalEditorRequest.prefill;
      setEditorState({
        mode: 'add',
        step: 'kind',
        graphPrefill: {
          fromComponent: p.fromComponent ?? p.branchSrcComp,
          fromCavity:    p.fromCavity    ?? p.branchSrcCav,
        },
      });
      onExternalRequestConsumed?.();
      return;
    }

    if (externalEditorRequest.type === 'edit') {
      const wire = effectiveWiresRef.current.find(w => w.wireId === externalEditorRequest.wireId);
      if (wire) {
        const opVersion = editedMapRef.current.get(wire.wireId);
        const base = opVersion ? wireToForm(opVersion) : wireToForm(wire);
        setEditorState({
          mode: 'edit',
          form: base,
          id:           opVersion?.id ?? `op-${wire.wireId}-${Date.now()}`,
          createdAt:    opVersion?.createdAt ?? new Date().toISOString(),
          targetWireId: opVersion?.targetWireId ?? wire.wireId ?? null,
          isAddedWire:  false,
        });
      }
      onExternalRequestConsumed?.();
      return;
    }

    if (externalEditorRequest.type === 'branch') {
      const { fromComponent, fromCavity } = externalEditorRequest;
      setEditorState({
        mode: 'add',
        step: 'kind',
        graphPrefill: { fromComponent, fromCavity },
      });
      onExternalRequestConsumed?.();
      return;
    }
  }, [externalEditorRequest, onExternalRequestConsumed]);

  const openAddForm = useCallback(() => {
    setEditorState({ mode: 'add', step: 'kind' });
  }, []);

  const handleKindSelected = useCallback((kind: AddedWireKind) => {
    if (!editorState || editorState.mode !== 'add' || editorState.step !== 'kind') return;
    const gp = editorState.graphPrefill;
    if (kind === 'STANDALONE') {
      setEditorState({
        mode: 'add',
        step: 'wire-form',
        addedWireKind: 'STANDALONE',
        sharedNode: undefined,
        form: { ...emptyForm(), fromComponent: gp?.fromComponent ?? '', fromCavity: gp?.fromCavity ?? '', topology: 'LINEAR' },
      });
    } else {
      setEditorState({ mode: 'add', step: 'shared-node', kind, graphPrefill: gp });
    }
  }, [editorState]);

  const handleSharedNodeContinue = useCallback((data: SharedNodeStepData) => {
    if (!editorState || editorState.mode !== 'add' || editorState.step !== 'shared-node') return;
    const { kind } = editorState;
    const topology = addedWireKindToTopology(kind);
    const isFerruleKind = kind === 'DOUBLE_CRIMP_FERRULE' || kind === 'MACHINE_CRIMP_BAND';
    const sharedNodeInput: SharedNodeInput = {
      kind,
      sharedComponent: data.sharedComp,
      sharedCavity:    data.sharedCav,
      sharedPartNumber: data.hardwarePN || null,
      sharedAci:         data.hardwareAci || null,
    };
    setEditorState({
      mode: 'add',
      step: 'wire-form',
      addedWireKind: kind,
      sharedNode: sharedNodeInput,
      form: {
        ...emptyForm(),
        fromComponent:   data.sharedComp,
        fromCavity:      data.sharedCav,
        fromTermination: isFerruleKind ? 'FERRULE' : kind === 'DOUBLE_CRIMP_TERMINAL' ? 'TERMINAL' : 'CONNECTOR_PIN',
        topology,
        branchSrcComp:   data.sharedComp,
        branchSrcCav:    data.sharedCav,
        branchFerrulePN:  isFerruleKind ? data.hardwarePN : '',
        branchTerminalPN: isFerruleKind ? '' : data.hardwarePN,
        branchAci:        data.hardwareAci,
      },
    });
  }, [editorState]);

  const handleSharedNodeBack = useCallback(() => {
    if (!editorState || editorState.mode !== 'add' || editorState.step !== 'shared-node') return;
    setEditorState({ mode: 'add', step: 'kind', graphPrefill: editorState.graphPrefill });
  }, [editorState]);

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
      targetWireId: opVersion?.targetWireId ?? wire.wireId ?? null,
      isAddedWire: false,
    });
  }, [editedMap]);

  const handleSave = useCallback((wire: OperatorWireModel) => {
    if (editorState?.mode === 'add' && editorState.step === 'wire-form') {
      onAddWire({ ...wire, addedWireKind: editorState.addedWireKind });
    } else if (editorState?.mode === 'edit' && editorState.isAddedWire) {
      onAddWire(wire);
    } else {
      onEditWire(wire);
    }
    setEditorState(null);
  }, [editorState, onAddWire, onEditWire]);

  const handleDelete = useCallback((request: SkuModelDeleteRequest, label: string) => {
    if (confirm(`Delete ${label} from effective model?`)) {
      onDeleteWire(request);
    }
  }, [onDeleteWire]);

  const decisionColor =
    overallDecision === 'SAFE' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    overallDecision === 'BLOCKED' ? 'text-red-700 bg-red-50 border-red-200' :
    overallDecision === 'REVIEW_REQUIRED' ? 'text-amber-700 bg-amber-50 border-amber-200' :
    'text-[color:var(--text-secondary)] bg-[color:var(--panel-bg)] border-[color:var(--panel-border)]';

  return (
    <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--surface-elevated)] shadow-sm overflow-hidden text-[12px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[color:var(--panel-border)] flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gray-400">T12 SKU Model</p>
          <h2 className="text-sm font-bold text-[color:var(--text-primary)]">Authoritative Wire Editor</h2>
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
      <div className="flex gap-4 px-4 py-2 border-b border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[11px] text-[color:var(--text-secondary)]">
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

      {/* Wire-add wizard + editor form (inline) */}
      {editorState && (
        <div className="px-4 py-3 border-b border-blue-100 bg-blue-50/20">
          {editorState.mode === 'add' && editorState.step === 'kind' && (
            <KindStepPanel
              onKindSelected={handleKindSelected}
              onCancel={() => setEditorState(null)}
            />
          )}
          {editorState.mode === 'add' && editorState.step === 'shared-node' && (
            <SharedNodeStepPanel
              kind={editorState.kind}
              prefillComp={editorState.graphPrefill?.fromComponent}
              prefillCav={editorState.graphPrefill?.fromCavity}
              onContinue={handleSharedNodeContinue}
              onBack={handleSharedNodeBack}
              onCancel={() => setEditorState(null)}
            />
          )}
          {editorState.mode === 'add' && editorState.step === 'wire-form' && (
            <WireEditorForm
              initialForm={editorState.form}
              wizardContext={{ addedWireKind: editorState.addedWireKind, sharedNode: editorState.sharedNode }}
              mode="add"
              onSave={handleSave}
              onCancel={() => setEditorState(null)}
            />
          )}
          {editorState.mode === 'edit' && (
            <WireEditorForm
              initialForm={editorState.form}
              existingId={editorState.id}
              existingCreatedAt={editorState.createdAt}
              targetWireId={editorState.targetWireId}
              mode="edit"
              onSave={handleSave}
              onCancel={() => setEditorState(null)}
            />
          )}
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
                  targetWireId: wire.targetWireId ?? null,
                  isAddedWire: true,
                });
              }}
              onDelete={() => handleDelete({ scope: 'operator', operatorId: wire.id }, formatWireLabel(wire.wireId))}
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
            <div className="sticky top-0 z-10 grid grid-cols-[3rem_5rem_3rem_3rem_6rem_1rem_6rem_5rem_auto] gap-x-2 px-4 py-1 bg-[color:var(--panel-bg)] border-b border-[color:var(--panel-border)] text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
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
                    editorState.targetWireId === wire.wireId
                  }
                  extractedFrom={extractedConnectivity?.wires.find(w => w.wireId === wire.wireId) ?? null}
                  internalWireId={wireIdentities?.byOriginalId.get(wire.wireId)?.internalWireId}
                  onEdit={() => openEditForm(wire)}
                  onDelete={() => handleDelete({ scope: 'extracted', wireId: wire.wireId }, formatWireLabel(wire.wireId))}
                  onUndoDelete={() => onDeleteWire({ scope: 'extracted', wireId: wire.wireId, undo: true })}
                />
              );
            })}
          </>
        )}
      </div>

      {/* Footer: decision detail */}
      {(effectiveConnectivity || effectiveDecision) && (
        <div className="px-4 py-2 border-t border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[10px] text-[color:var(--text-secondary)] flex flex-wrap gap-3">
          {effectiveDecision && (
            <span>Readiness: <strong className="text-gray-700">{effectiveDecision.readinessScore}%</strong></span>
          )}
          {effectiveConnectivity && (
            <span>Unresolved: <strong className={effectiveConnectivity.unresolvedWires.length > 0 ? 'text-red-600' : 'text-gray-700'}>
              {effectiveConnectivity.unresolvedWires.length}
            </strong></span>
          )}
          {effectiveDecision && effectiveDecision.blockedWires.length > 0 && (
            <span className="text-red-600 font-semibold">
              Blocked wires: {effectiveDecision.blockedWires.map(wid => {
                const ident = wireIdentities?.byOriginalId.get(wid);
                if (ident?.internalWireId && ident.internalWireId !== wid) return ident.internalWireId;
                const w = effectiveConnectivity?.wires.find(x => x.wireId === wid);
                if (!w) return wid;
                const f = `${w.from.component ?? '?'}${w.from.cavity ? ':' + w.from.cavity : ''}`;
                const t = `${w.to.component ?? '?'}${w.to.cavity ? ':' + w.to.cavity : ''}`;
                return `${f}\u2009\u2192\u2009${t}`;
              }).join(', ')}
            </span>
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
  const displayId = formatWireLabel(wire.wireId);
  return (
    <div className="grid grid-cols-[3rem_5rem_3rem_3rem_6rem_1rem_6rem_5rem_auto] gap-x-2 items-center px-4 py-1.5 border-b border-blue-100 bg-blue-50/20 hover:bg-blue-50/40">
      <span className="font-mono font-bold text-blue-700 text-[11px]">{displayId}</span>
      <span className="font-mono text-[11px] text-blue-600">{wire.length != null ? `${wire.length} in` : dash}</span>
      <span className="font-mono text-[11px] text-gray-500">{wire.gauge ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-500">{wire.color ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-600 truncate" title={describeTermination(wire.from as AnyEndpoint) ?? wire.from.component ?? ''}>{endpointDisplay(wire.from)}</span>
      <span className="text-gray-300 text-[11px]">→</span>
      <span className="font-mono text-[11px] text-gray-600 truncate" title={describeTermination(wire.to as AnyEndpoint) ?? wire.to.component ?? ''}>{endpointDisplay(wire.to)}</span>
      <span className="inline-flex items-center gap-0.5">
        <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[9px] font-semibold">Added by Operator</span>
      </span>
      <span className="flex gap-1 justify-end">
        <button type="button" onClick={onEdit}
          className="px-2 py-0.5 text-[10px] rounded border border-[color:var(--panel-border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-elevated)]">Edit</button>
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
  internalWireId,
  onEdit,
  onDelete,
  onUndoDelete,
}: {
  wire: WireConnectivity;
  isDeleted: boolean;
  isEdited: boolean;
  isCurrentlyEditing: boolean;
  extractedFrom: WireConnectivity | null;
  internalWireId?: string;
  onEdit: () => void;
  onDelete: () => void;
  onUndoDelete: () => void;
}) {
  const lengthDisplay = wire.lengthInches != null
    ? `${wire.lengthInches} in`
    : wire.length != null ? `${wire.length}` : dash;
  const displayId = formatWireLabel(wire.wireId);

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
    <div className={`grid grid-cols-[3rem_5rem_3rem_3rem_6rem_1rem_6rem_5rem_auto] gap-x-2 items-start px-4 py-1.5 border-b border-[color:var(--panel-border)] hover:bg-[color:var(--table-row-hover)] transition ${rowCls}`}>
      <span className="font-mono font-semibold text-gray-800 text-[11px] pt-0.5">
        {internalWireId ? (
          <>
            <span className="text-blue-700">{internalWireId}</span>
            {displayId !== internalWireId && (
              <span className="block text-[9px] text-gray-400 font-normal leading-tight">{displayId}</span>
            )}
          </>
        ) : displayId}
      </span>
      <span className="font-mono text-[11px] text-gray-600 pt-0.5">{lengthDisplay}</span>
      <span className="font-mono text-[11px] text-gray-500 pt-0.5">{wire.gauge ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-500 pt-0.5">{wire.color ?? dash}</span>
      <span className="font-mono text-[11px] text-gray-600 truncate pt-0.5" title={describeTermination(wire.from) ?? wire.from.component ?? ''}>{endpointDisplay(wire.from)}</span>
      <span className="text-gray-300 text-[11px] pt-0.5">→</span>
      <span className="font-mono text-[11px] text-gray-600 truncate pt-0.5" title={describeTermination(wire.to) ?? wire.to.component ?? ''}>{endpointDisplay(wire.to)}</span>
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
              className="px-2 py-0.5 text-[10px] rounded border border-[color:var(--panel-border)] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-elevated)]">Edit</button>
            <button type="button" onClick={onDelete}
              className="px-2 py-0.5 text-[10px] rounded border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
          </>
        )}
      </span>
    </div>
  );
}
