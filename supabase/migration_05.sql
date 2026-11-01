-- =====================================================
-- Halaqah App - Migration 05: รายงานปลายปี + ตอบรับนัดของศิษย์เก่า
-- รันต่อจาก migration_04.sql (รันซ้ำได้)
-- =====================================================

-- ---------- คะแนนประเมินปลายปี (ส่วนที่ครูกรอกเอง: มารยาท + การเรียน) ----------
-- ตั้งใจ "ไม่เก็บ" ระดับกลุ่ม (ใกล้ชิด/ใส่ใจ/พัฒนา/นำ) ของนักเรียน ระบบคำนวณข้อเสนอแนะตอนดูรายงานเท่านั้น
create table if not exists public.year_end_ratings (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  academic_year text not null,                       -- เช่น '2569'
  akhlaq smallint check (akhlaq between 1 and 5),    -- มารยาท
  study smallint check (study between 1 and 5),      -- การเรียน
  note text,
  rated_by uuid default auth.uid() references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (student_id, academic_year)
);
alter table public.year_end_ratings enable row level security;

-- นักเรียนไม่เห็นคะแนนประเมินของตัวเอง / ครูของกลุ่มและแอดมินอ่านและแก้ได้
drop policy if exists ratings_read on public.year_end_ratings;
create policy ratings_read on public.year_end_ratings for select to authenticated
  using (public.is_admin() or public.is_murabbi_of(student_id));
drop policy if exists ratings_write on public.year_end_ratings;
create policy ratings_write on public.year_end_ratings for all to authenticated
  using (public.is_admin() or public.is_murabbi_of(student_id))
  with check (public.is_admin() or public.is_murabbi_of(student_id));

-- ---------- ศิษย์เก่าตอบรับนัด ----------
create table if not exists public.alumni_rsvps (
  post_id bigint not null references public.alumni_posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  answer text not null check (answer in ('yes','maybe','no')),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.alumni_rsvps enable row level security;

drop policy if exists rsvps_own on public.alumni_rsvps;
create policy rsvps_own on public.alumni_rsvps for all to authenticated
  using (user_id = auth.uid() and public.my_role() = 'alumni')
  with check (user_id = auth.uid() and public.my_role() = 'alumni');

-- สรุปจำนวนผู้ตอบรับ (ไม่เปิดเผยชื่อ) สำหรับมูร๊อบบีย์และแอดมิน
create or replace function public.rsvp_summary()
returns table (post_id bigint, yes bigint, maybe bigint, no bigint)
language sql stable security definer set search_path = public as $$
  select r.post_id,
         count(*) filter (where r.answer = 'yes'),
         count(*) filter (where r.answer = 'maybe'),
         count(*) filter (where r.answer = 'no')
  from public.alumni_rsvps r
  where public.my_role() in ('murabbi','admin')
  group by r.post_id
$$;
revoke all on function public.rsvp_summary() from public, anon;
grant execute on function public.rsvp_summary() to authenticated;
