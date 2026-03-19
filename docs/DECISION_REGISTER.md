# Decision Register

Important architectural and design decisions for EMIP-PPAP.

---

## DEC-001: Use Next.js + Supabase + Vercel
- Date: 2026-03-19
- Status: Accepted
- Context: Need to build production-ready PPAP operations module by Monday with minimal infrastructure overhead
- Decision: Use Next.js 15 (App Router) for frontend/backend, Supabase for database and auth, Vercel for hosting
- Consequences:
  - ✅ Fast development with server components and server actions
  - ✅ Built-in auth and real-time capabilities via Supabase
  - ✅ Zero-config deployment via Vercel
  - ✅ TypeScript support throughout stack
  - ⚠️ Vendor lock-in to Supabase ecosystem
  - ⚠️ Learning curve for Next.js 15 App Router patterns

---

## DEC-002: Canonical status workflow
- Date: 2026-03-19
- Status: Accepted
- Context: Need clear, enforceable workflow states that reflect actual PPAP process across multiple sites
- Decision: Define 14 canonical statuses (NEW → INTAKE_COMPLETE → ... → CLOSED) that must be preserved in code
- Consequences:
  - ✅ Clear handoff points between roles
  - ✅ Prevents ad-hoc status proliferation
  - ✅ Enables reliable reporting and filtering
  - ⚠️ Status changes require code updates if workflow evolves
  - ⚠️ Must enforce in database constraints and UI

---

## DEC-003: Event-sourced audit trail
- Date: 2026-03-19
- Status: Accepted
- Context: Need complete audit trail for compliance and debugging cross-site handoffs
- Decision: Every mutation writes to ppap_events table with actor, timestamp, event_type, and payload
- Consequences:
  - ✅ Complete audit history
  - ✅ Can reconstruct state at any point in time
  - ✅ Supports debugging and compliance
  - ⚠️ Adds write overhead to every mutation
  - ⚠️ Event table will grow large over time

---

## DEC-004: Feature-based folder structure
- Date: 2026-03-19
- Status: Accepted
- Context: Need to organize code by domain to keep business logic separate from presentation
- Decision: Use `src/features/{ppap,conversations,tasks,documents}` structure with data access separated from UI
- Consequences:
  - ✅ Clear separation of concerns
  - ✅ Easier to locate related functionality
  - ✅ Supports parallel development
  - ⚠️ May require refactoring as features grow
  - ⚠️ Need discipline to avoid circular dependencies

---

## DEC-005: Mold tracking as first-class concern
- Date: 2026-03-19
- Status: Accepted
- Context: Mold/overmold complexity is critical path item that often causes delays
- Decision: Add mold-specific fields directly to ppap_records table and surface prominently in UI
- Consequences:
  - ✅ Mold status visible at a glance
  - ✅ Can filter and report on mold-related delays
  - ✅ Treats mold as blocker/risk signal
  - ⚠️ Adds complexity to intake form
  - ⚠️ Fields may be null for non-mold parts

---

## DEC-006: Internal conversation log per PPAP
- Date: 2026-03-19
- Status: Accepted
- Context: Cross-site communication often lost in email threads; need centralized context
- Decision: Add ppap_conversations table with flat chronological notes tied to each PPAP record
- Consequences:
  - ✅ Preserves cross-site context
  - ✅ Reduces information loss during handoffs
  - ✅ Single source of truth for internal updates
  - ⚠️ Users must adopt new communication pattern
  - ⚠️ May duplicate some email content initially

---

## DEC-007: Minimal permissions for v1
- Date: 2026-03-19
- Status: Accepted
- Context: Full RBAC system would delay Monday go-live
- Decision: Basic role awareness (coordinator, engineer, quality, manager) without enforced permissions in v1
- Consequences:
  - ✅ Faster delivery
  - ✅ Can add enforcement later
  - ⚠️ Trust-based access control initially
  - ⚠️ Must add proper permissions before external users

---
