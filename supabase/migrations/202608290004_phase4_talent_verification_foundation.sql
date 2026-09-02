-- Additive review foundation for employee-entered professional information.
create type public.professional_review_status as enum ('pending', 'approved', 'rejected');

alter table public.employee_skills add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);
alter table public.experiences add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);
alter table public.education add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);
alter table public.certifications add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);
alter table public.projects add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);
alter table public.achievements add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);
alter table public.talent_profiles add column review_status public.professional_review_status not null default 'pending', add column reviewed_by uuid references public.profiles(id) on delete set null, add column reviewed_at timestamptz, add column reviewer_notes text check (reviewer_notes is null or char_length(reviewer_notes) <= 1000);

create function public.prevent_employee_review_mutation() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_hr_or_admin() then return new; end if;
  if tg_op = 'INSERT' then
    if new.review_status <> 'pending' or new.reviewed_by is not null or new.reviewed_at is not null or new.reviewer_notes is not null then
      raise exception 'Employees cannot set review fields' using errcode = '42501';
    end if;
  elsif new.review_status is distinct from old.review_status or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at or new.reviewer_notes is distinct from old.reviewer_notes then
    raise exception 'Employees cannot modify review fields' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger employee_skills_review_guard before insert or update on public.employee_skills for each row execute function public.prevent_employee_review_mutation();
create trigger experiences_review_guard before insert or update on public.experiences for each row execute function public.prevent_employee_review_mutation();
create trigger education_review_guard before insert or update on public.education for each row execute function public.prevent_employee_review_mutation();
create trigger certifications_review_guard before insert or update on public.certifications for each row execute function public.prevent_employee_review_mutation();
create trigger projects_review_guard before insert or update on public.projects for each row execute function public.prevent_employee_review_mutation();
create trigger achievements_review_guard before insert or update on public.achievements for each row execute function public.prevent_employee_review_mutation();
create trigger talent_profiles_review_guard before insert or update on public.talent_profiles for each row execute function public.prevent_employee_review_mutation();

create index employee_skills_review_status_idx on public.employee_skills(employee_id, review_status);
create index experiences_review_status_idx on public.experiences(employee_id, review_status);
create index education_review_status_idx on public.education(employee_id, review_status);
create index certifications_review_status_idx on public.certifications(employee_id, review_status);
create index projects_review_status_idx on public.projects(employee_id, review_status);
create index achievements_review_status_idx on public.achievements(employee_id, review_status);

create view public.approved_talent_profiles with (security_invoker = true) as
select employee_id, talent_id, professional_name, professional_title, summary, visibility
from public.talent_profiles where review_status = 'approved';
