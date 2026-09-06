-- ============================================================
-- Migration: 202609070004_fix_hr_attendance_checkout.sql
-- Description: Correct attendance anti-tampering trigger to distinguish
-- between employee self check-out (applicable to all workforce roles
-- including HR) and administrative review operations.
--
-- Root Cause:
-- The previous implementation of public.prevent_employee_attendance_tampering()
-- checked `if not public.is_hr_for_org(new.organization_id)` to branch into
-- employee self-update logic, routing all HR users into the review branch.
-- In the review branch, setting check_out_at or check_out_photo_path raised:
-- 'Attendance timestamps and photos cannot be altered by review' (42501).
--
-- Fix:
-- Branch on `public.owns_attendance_employee(old.employee_id)` for self-updates
-- (check-out), allowing HR users to check out their own attendance records
-- while keeping review immutability strictly enforced for review operations.
-- ============================================================

create or replace function public.prevent_employee_attendance_tampering() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    -- Any employee checking in (Employee, Manager, HR) must have pending status and no checkout/review fields
    if new.check_in_verification_status <> 'pending' or
       new.check_in_reviewed_by is not null or
       new.check_in_reviewed_at is not null or
       new.check_in_review_notes is not null or
       new.check_out_at is not null or
       new.check_out_photo_path is not null or
       new.check_out_verification_status is not null or
       new.check_out_reviewed_by is not null or
       new.check_out_reviewed_at is not null or
       new.check_out_review_notes is not null then
      raise exception 'Employees cannot set review or checkout fields on check-in' using errcode = '42501';
    end if;
    new.check_in_at := now();

  elsif tg_op = 'UPDATE' then
    if public.owns_attendance_employee(old.employee_id) then
      -- Employee self-update check (Check-out):
      -- Applies to any employee checking out of their own active session (Employee, Manager, HR)
      if new.check_in_at is distinct from old.check_in_at or
         new.check_in_photo_path is distinct from old.check_in_photo_path or
         new.check_in_verification_status is distinct from old.check_in_verification_status or
         new.check_in_reviewed_by is distinct from old.check_in_reviewed_by or
         new.check_in_reviewed_at is distinct from old.check_in_reviewed_at or
         new.check_in_review_notes is distinct from old.check_in_review_notes or
         new.check_out_verification_status is distinct from coalesce(old.check_out_verification_status, 'pending') or
         new.check_out_reviewed_by is distinct from old.check_out_reviewed_by or
         new.check_out_reviewed_at is distinct from old.check_out_reviewed_at or
         new.check_out_review_notes is distinct from old.check_out_review_notes then
        raise exception 'Employees cannot modify timestamps or review fields' using errcode = '42501';
      end if;

      if old.check_out_at is not null then
        raise exception 'Completed attendance sessions cannot be modified' using errcode = '42501';
      end if;

      if new.check_out_at is not null then
        new.check_out_at := now();
        new.check_out_verification_status := 'pending';
        new.check_out_reviewed_by := null;
        new.check_out_reviewed_at := null;
        new.check_out_review_notes := null;
      end if;
    elsif public.is_hr_for_org(new.organization_id) then
      -- HR review update on another employee's attendance record:
      -- Strictly preserves original check-in and check-out timestamps and photos
      if new.check_in_at is distinct from old.check_in_at or
         new.check_out_at is distinct from old.check_out_at or
         new.check_in_photo_path is distinct from old.check_in_photo_path or
         new.check_out_photo_path is distinct from old.check_out_photo_path then
        raise exception 'Attendance timestamps and photos cannot be altered by review' using errcode = '42501';
      end if;
    else
      raise exception 'Unauthorized attendance modification' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

-- Ensure tamper guard trigger is properly bound
drop trigger if exists attendance_records_tamper_guard on public.attendance_records;
create trigger attendance_records_tamper_guard before insert or update on public.attendance_records
  for each row execute function public.prevent_employee_attendance_tampering();

-- HR Review RPC: also explicitly guard against self-review by HR personnel
create or replace function public.review_attendance_photo(
  p_attendance_id uuid,
  p_event_type text, -- 'check_in' or 'check_out'
  p_status public.attendance_verification_status,
  p_notes text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
begin
  select organization_id into v_org_id from public.profiles where id = auth.uid();

  if not public.has_role(array['hr']) then
    raise exception 'Only HR role can verify attendance photos' using errcode = '42501';
  end if;

  -- Ensure HR reviewer is not verifying their own attendance photos
  if exists (
    select 1 from public.attendance_records
    where id = p_attendance_id and public.owns_attendance_employee(employee_id)
  ) then
    raise exception 'HR personnel cannot verify their own attendance photos' using errcode = '42501';
  end if;

  if p_event_type = 'check_in' then
    update public.attendance_records
    set
      check_in_verification_status = p_status,
      check_in_reviewed_by = auth.uid(),
      check_in_reviewed_at = now(),
      check_in_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id and organization_id = v_org_id;
  elsif p_event_type = 'check_out' then
    update public.attendance_records
    set
      check_out_verification_status = p_status,
      check_out_reviewed_by = auth.uid(),
      check_out_reviewed_at = now(),
      check_out_review_notes = nullif(trim(p_notes), '')
    where id = p_attendance_id and organization_id = v_org_id;
  else
    raise exception 'Invalid event type. Must be check_in or check_out' using errcode = '22023';
  end if;

  if not found then
    raise exception 'Attendance record not found in your organization' using errcode = 'P0002';
  end if;

  return true;
end;
$$;

grant execute on function public.review_attendance_photo(uuid, text, public.attendance_verification_status, text) to authenticated;

