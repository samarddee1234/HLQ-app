-- =====================================================
-- Halaqah App - Database schema (MVP step 1)
-- วิธีใช้: Supabase Dashboard > SQL Editor > วางทั้งไฟล์แล้วกด Run
-- =====================================================

-- ---------- ตาราง ----------
create table if not exists public.groups (
  id bigint generated always as identity primary key,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  grade text,                 -- ม.1 ... ม.6
  class_room text,            -- ห้อง
  group_id bigint references public.groups(id),
  role text not null default 'student' check (role in ('student','murabbi','admin')),
  requested_role text not null default 'student' check (requested_role in ('student','murabbi')),
  phone text,
  facebook text,
  theme text not null default 'navy',
  registered boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.prayer_checks (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  check_date date not null,
  prayer text not null check (prayer in ('zuhr','asr')),
  status text not null check (status in ('on_time','late','absent','excused','menstruation')),
  checked_by uuid default auth.uid() references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, check_date, prayer)
);

create table if not exists public.halaqah_attendance (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,   -- วันจันทร์ของสัปดาห์นั้น
  status text not null check (status in ('present','absent','excused')),
  checked_by uuid default auth.uid() references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (student_id, week_start)
);

create index if not exists idx_prayer_student_date on public.prayer_checks(student_id, check_date);
create index if not exists idx_profiles_group on public.profiles(group_id);

-- ---------- สร้างโปรไฟล์อัตโนมัติเมื่อมีคนสมัคร ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- ฟังก์ชันช่วยตรวจสิทธิ์ ----------
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.my_group() returns bigint
language sql stable security definer set search_path = public as
$$ select group_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select coalesce(public.my_role() = 'admin', false) $$;

-- true เมื่อผู้ใช้เป็นมูร๊อบบีย์ และนักเรียนคนนั้นอยู่กลุ่มเดียวกับตน
create or replace function public.is_murabbi_of(student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'murabbi'
     and exists (
       select 1 from public.profiles s
       where s.id = student and s.group_id is not null and s.group_id = public.my_group()
     )
$$;

-- ---------- กันการเลื่อนสิทธิ์ตัวเอง ----------
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- SQL Editor (auth.uid() เป็น null) และแอดมิน แก้ได้ทุกอย่าง
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'ไม่สามารถเปลี่ยนบทบาทเองได้';
  end if;
  if old.role = 'murabbi' and new.group_id is distinct from old.group_id then
    raise exception 'กลุ่มของมูร๊อบบีย์กำหนดโดยแอดมินเท่านั้น';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg
  before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- Row Level Security ----------
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.prayer_checks enable row level security;
alter table public.halaqah_attendance enable row level security;

-- groups: ทุกคนที่ล็อกอินอ่านได้ (ใช้ตอนลงทะเบียน), แอดมินจัดการ
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated using (true);
drop policy if exists groups_admin on public.groups;
create policy groups_admin on public.groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (
  id = auth.uid()
  or public.is_admin()
  or (public.my_role() = 'murabbi' and group_id is not null and group_id = public.my_group())
  or (role = 'murabbi' and group_id is not null and group_id = public.my_group()) -- นักเรียนเห็นครูกลุ่มตัวเอง
);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- prayer_checks
drop policy if exists prayer_read on public.prayer_checks;
create policy prayer_read on public.prayer_checks for select to authenticated using (
  student_id = auth.uid() or public.is_admin() or public.is_murabbi_of(student_id)
);
drop policy if exists prayer_write on public.prayer_checks;
create policy prayer_write on public.prayer_checks for all to authenticated
  using (public.is_admin() or public.is_murabbi_of(student_id))
  with check (public.is_admin() or public.is_murabbi_of(student_id));

-- halaqah_attendance
drop policy if exists att_read on public.halaqah_attendance;
create policy att_read on public.halaqah_attendance for select to authenticated using (
  student_id = auth.uid() or public.is_admin() or public.is_murabbi_of(student_id)
);
drop policy if exists att_write on public.halaqah_attendance;
create policy att_write on public.halaqah_attendance for all to authenticated
  using (public.is_admin() or public.is_murabbi_of(student_id))
  with check (public.is_admin() or public.is_murabbi_of(student_id));

-- ---------- คะแนนรายสัปดาห์ ----------
-- ทันเวลา 1 | สาย 0.5 | ไม่ขึ้น 0 | ลากิจ/ป่วย 1 | รอบเดือน 1
create or replace view public.weekly_scores with (security_invoker = true) as
select
  student_id,
  date_trunc('week', check_date)::date as week_start,
  sum(case status
        when 'on_time' then 1
        when 'late' then 0.5
        when 'excused' then 1
        when 'menstruation' then 1
        else 0 end) as score,
  count(*) as checked,
  count(*) filter (where status = 'on_time') as on_time,
  count(*) filter (where status = 'late') as late,
  count(*) filter (where status = 'absent') as absent
from public.prayer_checks
group by student_id, date_trunc('week', check_date)::date;

-- ---------- ตัวอย่างกลุ่ม (แก้ชื่อได้) ----------
insert into public.groups (name) values ('กลุ่มใกล้ชิด'), ('กลุ่มตัวอย่าง 2')
on conflict (name) do nothing;

-- =====================================================
-- งานแอดมิน (รันใน SQL Editor)
-- =====================================================
-- ตั้งตัวเองเป็นแอดมิน:
--   update public.profiles set role = 'admin' where email = 'อีเมลของคุณ';
-- อนุมัติมูร๊อบบีย์ + กำหนดกลุ่ม:
--   update public.profiles
--   set role = 'murabbi', group_id = (select id from public.groups where name = 'กลุ่มใกล้ชิด')
--   where email = 'อีเมลครู';
