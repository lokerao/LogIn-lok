-- ============================================================
-- LogIn — Phase 9 Additive Corrective Migration
-- Corrective Leave Reconciliation & Concurrency Hardening
-- Migration: 202609040007_phase9_workforce_leave_reconciliation_correction.sql
-- ============================================================
--
-- This migration corrects public.review_attendance_photo:
--
-- 1. MULTIPLE DAILY SESSIONS: Ensures at most ONE leave-day refund per
--    calendar date per employee, even if multiple attendance sessions exist
--    for the same date.
-- 2. VERIFIED CHECK-IN RECONCILIATION: Reconciles leave only when check-in
--    is verified/approved. Works regardless of review order (check-in first,
--    check-out first, or separate times).
-- 3. CHECK-OUT REJECTION SAFETY: Prevents a rejected check-out photo from
--    reversing a leave reconciliation earned from a verified check-in.
-- 4. CHECK-IN REVERSAL RESTORATION: Reversal occurs only upon explicit
--    check-in rejection on the reconciled record, and safely clamps used_days
--    to allocated_days to prevent check constraint violations.
-- 5. CONCURRENCY SERIALIZATION: Uses pg_advisory_xact_lock keyed to
--    (employee_id, attendance_date) and SELECT FOR UPDATE on leave_balances
--    to serialize concurrent HR reviews and prevent race conditions.
-- ============================================================

-- Ensure leave_reconciled column exists on attendance_records
alter table public.attendance_records
  add column if not exists leave_reconciled boolean not null default false;

-- ============================================================
-- CORRECTED review_attendance_photo RPC
-- ============================================================
create or replace function public.review_attendance_photo(
  p_attendance_id uuid,
  p_event_type text, -- 'check_in' or 'check_out'
  p_status public.attendance_verification_status,
  p_notes text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_caller_uid             uuid := auth.uid();
  v_org_id                 uuid;
  v_att                    record;
  v_lr                     record;
  v_bal                    record;
  v_refund_days            numeric(5,1);
  v_year                   integer;
  v_effective_check_in_st  public.attendance_verification_status;
  v_already_reconciled     boolean;
begin
  if v_caller_uid is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select organization_id into v_org_id from public.profiles where id = v_caller_uid;

  if not public.has_role(array['hr']) then
    raise exception 'Only HR role can verify attendance photos' using errcode = '42501';
  end if;

  -- 1. Lock the attendance record row to serialize updates on this record
  select * into v_att
  from public.attendance_records
  where id = p_attendance_id and organization_id = v_org_id
  for update;

  if not found then
    raise exception 'Attendance record not found in your organization' using errcode = 'P0002';
  end if;

  -- 2. Apply the event-specific photo review update
  if p_event_type = 'check_in' then
    update public.attendance_records
    set
      check_in_verification_status = p_status,
      check_in_reviewed_by = v_caller_uid,
      check_in_reviewed_at = now(),
      check_in_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id;

    v_effective_check_in_st := p_status;
  elsif p_event_type = 'check_out' then
    update public.attendance_records
    set
      check_out_verification_status = p_status,
      check_out_reviewed_by = v_caller_uid,
      check_out_reviewed_at = now(),
      check_out_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id;

    -- For checkout reviews, check-in status is the existing recorded status
    v_effective_check_in_st := v_att.check_in_verification_status;
  else
    raise exception 'Invalid event type. Must be check_in or check_out' using errcode = '22023';
  end if;

  -- 3. Acquire transaction-scoped advisory lock for (employee_id, attendance_date)
  -- This serializes concurrent HR reviews across different sessions for the same employee & date
  perform pg_advisory_xact_lock(
    hashtext('leave_reconciliation')::integer,
    hashtext(v_att.employee_id::text || '_' || v_att.attendance_date::text)::integer
  );

  -- 4. CASE 1: RECONCILIATION (Earned Worked Leave Day)
  -- Conditions:
  -- - Effective check-in verification status is 'approved' (verified proof of work)
  -- - This specific attendance record is not yet marked reconciled
  if v_effective_check_in_st = 'approved' and not v_att.leave_reconciled then
    -- Verify whether ANY other attendance session for this employee on this date
    -- has already claimed the leave reconciliation for this calendar date
    select exists (
      select 1 from public.attendance_records
      where employee_id = v_att.employee_id
        and attendance_date = v_att.attendance_date
        and leave_reconciled = true
        and id <> p_attendance_id
    ) into v_already_reconciled;

    -- If this calendar date has NOT already received reconciliation, proceed
    if not v_already_reconciled then
      -- Match active approved leave covering this attendance date
      select lr.id, lr.leave_type_id, lr.is_half_day, lr.requested_days
      into v_lr
      from public.leave_requests lr
      where lr.employee_id = v_att.employee_id
        and lr.status = 'approved'
        and v_att.attendance_date >= lr.start_date
        and v_att.attendance_date <= lr.end_date
      limit 1;

      if v_lr.id is not null then
        -- Preserve half-day (0.5) vs full-day (1.0) exact date semantics
        v_refund_days := case when v_lr.is_half_day then 0.5 else 1.0 end;
        v_year := extract(year from v_att.attendance_date)::integer;

        -- Acquire row lock on leave_balances to serialize mutations
        select * into v_bal
        from public.leave_balances
        where employee_id = v_att.employee_id
          and leave_type_id = v_lr.leave_type_id
          and year = v_year
        for update;

        if v_bal.id is not null then
          -- Refund the worked day to used_days (capping lower bound at 0)
          update public.leave_balances
          set used_days = greatest(0, used_days - v_refund_days),
              updated_at = now()
          where id = v_bal.id;

          -- Mark this specific attendance record as having performed the reconciliation
          update public.attendance_records
          set leave_reconciled = true
          where id = p_attendance_id;
        end if;
      end if;
    end if;

  -- 5. CASE 2: REVERSAL OF RECONCILIATION
  -- Conditions:
  -- - MUST be an explicit check_in rejection (p_event_type = 'check_in' and p_status = 'rejected')
  -- - This attendance record was the one that performed the reconciliation (v_att.leave_reconciled = true)
  -- IMPORTANT: Check-out rejection (p_event_type = 'check_out') NEVER enters this block.
  elsif p_event_type = 'check_in' and p_status = 'rejected' and v_att.leave_reconciled then
    select lr.id, lr.leave_type_id, lr.is_half_day
    into v_lr
    from public.leave_requests lr
    where lr.employee_id = v_att.employee_id
      and lr.status = 'approved'
      and v_att.attendance_date >= lr.start_date
      and v_att.attendance_date <= lr.end_date
    limit 1;

    if v_lr.id is not null then
      v_refund_days := case when v_lr.is_half_day then 0.5 else 1.0 end;
      v_year := extract(year from v_att.attendance_date)::integer;

      -- Acquire row lock on leave_balances
      select * into v_bal
      from public.leave_balances
      where employee_id = v_att.employee_id
        and leave_type_id = v_lr.leave_type_id
        and year = v_year
      for update;

      if v_bal.id is not null then
        -- Restore used_days, safely clamped to allocated_days to preserve check constraint
        update public.leave_balances
        set used_days = least(v_bal.allocated_days, used_days + v_refund_days),
            updated_at = now()
        where id = v_bal.id;

        -- Un-mark this attendance record
        update public.attendance_records
        set leave_reconciled = false
        where id = p_attendance_id;
      end if;
    end if;
  end if;

  return true;
end;
$$;

grant execute on function public.review_attendance_photo(uuid, text, public.attendance_verification_status, text) to authenticated;

