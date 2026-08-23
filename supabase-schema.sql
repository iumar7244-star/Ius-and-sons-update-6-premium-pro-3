-- IUS AND SONS - COMPLETE SUPABASE SETUP
-- Run this entire file once for a NEW Supabase project.
-- For an existing project, use supabase-migrate-safe.sql instead.

create extension if not exists "pgcrypto";

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  badge_url text,
  owner_id uuid references auth.users(id) on delete set null,
  phone1 text,
  phone2 text,
  school_code text unique,
  created_at timestamptz default now()
);

create unique index if not exists schools_owner_id_unique
  on schools(owner_id) where owner_id is not null;

create sequence if not exists school_code_seq start 1;

create or replace function assign_school_code() returns trigger
language plpgsql as $$
begin
  if new.school_code is null then
    new.school_code := '19722004' || lpad(nextval('school_code_seq')::text, 3, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assign_school_code on schools;
create trigger trg_assign_school_code
before insert on schools
for each row execute function assign_school_code();

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references schools(id) on delete cascade,
  full_name text,
  role text not null default 'admin' check (role in ('admin','teacher')),
  created_at timestamptz default now()
);

create table if not exists academic_years (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  year int not null,
  status text not null default 'active' check (status in ('active','closed')),
  created_at timestamptz default now(),
  unique (school_id, year)
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists streams (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists class_subjects (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references classes(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  unique (class_id, subject_id)
);

create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_code text not null,
  full_name text not null,
  gender text,
  created_at timestamptz default now(),
  unique (school_id, student_code)
);

create table if not exists student_placements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  stream_id uuid references streams(id) on delete set null,
  created_at timestamptz default now(),
  unique (student_id, academic_year_id)
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  academic_year_id uuid not null references academic_years(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  term text not null check (term in ('Term 1','Term 2','Term 3')),
  assessment_type text not null check (assessment_type in ('MIDTERM','END_TERM')),
  marks numeric not null check (marks >= 0 and marks <= 100),
  grade text,
  entered_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (student_id, subject_id, academic_year_id, term, assessment_type)
);

create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid references auth.users(id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

create table if not exists teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz default now()
);

create table if not exists teacher_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references teachers(id) on delete cascade,
  subject_id uuid not null references subjects(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  unique (teacher_id, subject_id, class_id)
);

-- RLS
alter table schools enable row level security;
alter table profiles enable row level security;
alter table academic_years enable row level security;
alter table classes enable row level security;
alter table streams enable row level security;
alter table subjects enable row level security;
alter table class_subjects enable row level security;
alter table students enable row level security;
alter table student_placements enable row level security;
alter table results enable row level security;
alter table activity_logs enable row level security;
alter table teachers enable row level security;
alter table teacher_subjects enable row level security;

create or replace function current_school_id()
returns uuid language sql stable security definer
set search_path = public
as $$
  select school_id from profiles where id = auth.uid();
$$;

-- Drop policies so this file can be re-run safely.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname
           from pg_policies
           where schemaname = 'public'
             and tablename in ('schools','profiles','academic_years','classes','streams','subjects','class_subjects','students','student_placements','results','activity_logs','teachers','teacher_subjects')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy "schools_select_own" on schools for select using (id = current_school_id());
create policy "schools_insert_own" on schools for insert with check (owner_id = auth.uid());
create policy "schools_update_own" on schools for update using (id = current_school_id()) with check (id = current_school_id());

create policy "profiles_select_same_school" on profiles for select using (school_id = current_school_id() or id = auth.uid());
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid());
create policy "profiles_update_self" on profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "academic_years_all" on academic_years for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "classes_all" on classes for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "streams_all" on streams for all using (class_id in (select id from classes where school_id = current_school_id())) with check (class_id in (select id from classes where school_id = current_school_id()));
create policy "subjects_all" on subjects for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "class_subjects_all" on class_subjects for all using (class_id in (select id from classes where school_id = current_school_id())) with check (class_id in (select id from classes where school_id = current_school_id()));
create policy "students_all" on students for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "student_placements_all" on student_placements for all using (student_id in (select id from students where school_id = current_school_id())) with check (student_id in (select id from students where school_id = current_school_id()));
create policy "results_all" on results for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "activity_logs_all" on activity_logs for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "teachers_all" on teachers for all using (school_id = current_school_id()) with check (school_id = current_school_id());
create policy "teacher_subjects_all" on teacher_subjects for all using (teacher_id in (select id from teachers where school_id = current_school_id())) with check (teacher_id in (select id from teachers where school_id = current_school_id()));

-- School-ID login lookup. This intentionally returns only the email attached to a School ID.
create or replace function get_login_email(p_school_code text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_email text;
begin
  select u.email into v_email
  from schools s
  join profiles p on p.school_id = s.id and p.role = 'admin'
  join auth.users u on u.id = p.id
  where upper(s.school_code) = upper(trim(p_school_code))
  order by p.created_at asc
  limit 1;
  return v_email;
end;
$$;

revoke all on function get_login_email(text) from public;
grant execute on function get_login_email(text) to anon, authenticated;

-- Storage
insert into storage.buckets (id, name, public) values ('badges','badges',true) on conflict (id) do update set public = true;

drop policy if exists "badge public read" on storage.objects;
drop policy if exists "badge auth upload" on storage.objects;
drop policy if exists "badge auth update" on storage.objects;
drop policy if exists "badge auth delete" on storage.objects;
create policy "badge public read" on storage.objects for select using (bucket_id = 'badges');
create policy "badge auth upload" on storage.objects for insert with check (bucket_id = 'badges' and auth.role() = 'authenticated');
create policy "badge auth update" on storage.objects for update using (bucket_id = 'badges' and auth.role() = 'authenticated') with check (bucket_id = 'badges' and auth.role() = 'authenticated');
create policy "badge auth delete" on storage.objects for delete using (bucket_id = 'badges' and auth.role() = 'authenticated');
