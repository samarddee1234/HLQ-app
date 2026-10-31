-- =====================================================
-- Halaqah App - Migration 03: ศิษย์เก่า + ลิงก์อัซการ PubHTML5
-- รันต่อจาก migration_02.sql (รันซ้ำได้ ไม่ทำให้ข้อมูลเดิมหาย)
-- วิธีใช้: Supabase > SQL Editor > New query > วางทั้งไฟล์ > Run
-- =====================================================

-- ---------- บทบาทใหม่: alumni (ศิษย์เก่า) + เลขรุ่น ----------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('student','murabbi','admin','alumni'));
alter table public.profiles drop constraint if exists profiles_requested_role_check;
alter table public.profiles add constraint profiles_requested_role_check
  check (requested_role in ('student','murabbi','alumni'));

alter table public.profiles add column if not exists batch int check (batch between 1 and 999); -- รุ่นที่ (ตัวเลขล้วน)
create index if not exists idx_profiles_batch on public.profiles(batch) where role = 'alumni';

-- ---------- ตัวป้องกัน: เปลี่ยนบทบาทเองไม่ได้ / ย้ายกลุ่มและเปลี่ยนรุ่นหลังลงทะเบียนต้องให้แอดมินทำ ----------
create or replace function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'ไม่สามารถเปลี่ยนบทบาทเองได้';
  end if;
  if old.registered and new.group_id is distinct from old.group_id then
    raise exception 'การย้ายกลุ่มทำโดยแอดมินเท่านั้น';
  end if;
  if old.registered and new.batch is distinct from old.batch then
    raise exception 'การแก้เลขรุ่นทำโดยแอดมินเท่านั้น';
  end if;
  return new;
end $$;

-- ---------- ฟังก์ชันช่วย ----------
create or replace function public.my_batch() returns int
language sql stable security definer set search_path = public as
$$ select batch from public.profiles where id = auth.uid() $$;

-- รายชื่อและช่องทางติดต่อของมูร๊อบบีย์ทุกคน: เฉพาะศิษย์เก่าและแอดมินเรียกได้
create or replace function public.murabbi_contacts()
returns table (full_name text, phone text, facebook text, group_name text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.phone, p.facebook, g.name
  from public.profiles p
  left join public.groups g on g.id = p.group_id
  where p.role = 'murabbi' and p.registered
    and public.my_role() in ('alumni','admin')
  order by g.name nulls last, p.full_name
$$;
revoke all on function public.murabbi_contacts() from public, anon;
grant execute on function public.murabbi_contacts() to authenticated;

-- ศิษย์เก่ารุ่นเดียวกัน (เฉพาะชื่อ และเฉพาะคนที่แอดมินอนุมัติแล้ว)
create or replace function public.batch_mates()
returns table (full_name text)
language sql stable security definer set search_path = public as $$
  select p.full_name
  from public.profiles p
  where p.role = 'alumni' and p.registered
    and p.batch is not null and p.batch = public.my_batch()
    and p.id <> auth.uid()
    and public.my_role() = 'alumni'
  order by p.full_name
$$;
revoke all on function public.batch_mates() from public, anon;
grant execute on function public.batch_mates() to authenticated;

-- ---------- โพสต์สำหรับศิษย์เก่า ----------
-- knowledge = สรุปความรู้จากมูร๊อบบีย์ | announcement = ประกาศ
-- online_halaqah = นัดฮาลาเกาะฮฺออนไลน์ (ใส่ event_at เพื่อให้แจ้งเตือนในวันนั้น) | reunion = งานรวมตัวศิษย์เก่า
create table if not exists public.alumni_posts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('knowledge','announcement','online_halaqah','reunion')),
  title text not null,
  body text,
  event_at timestamptz,
  batch int check (batch between 1 and 999),     -- ว่าง = ทุกรุ่น
  author uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_alumni_posts_created on public.alumni_posts(created_at desc);
create index if not exists idx_alumni_posts_event on public.alumni_posts(event_at);

alter table public.alumni_posts enable row level security;

-- อ่าน: แอดมินและมูร๊อบบีย์อ่านได้ทั้งหมด / ศิษย์เก่าอ่านเฉพาะโพสต์ของทุกรุ่นและของรุ่นตัวเอง
drop policy if exists alumni_posts_read on public.alumni_posts;
create policy alumni_posts_read on public.alumni_posts for select to authenticated using (
  public.is_admin()
  or public.my_role() = 'murabbi'
  or (public.my_role() = 'alumni' and (batch is null or batch = public.my_batch()))
);
-- เขียน: แอดมินทุกอย่าง / มูร๊อบบีย์แก้และลบได้เฉพาะโพสต์ของตัวเอง
drop policy if exists alumni_posts_insert on public.alumni_posts;
create policy alumni_posts_insert on public.alumni_posts for insert to authenticated
  with check (public.is_admin() or (public.my_role() = 'murabbi' and author = auth.uid()));
drop policy if exists alumni_posts_update on public.alumni_posts;
create policy alumni_posts_update on public.alumni_posts for update to authenticated
  using (public.is_admin() or (public.my_role() = 'murabbi' and author = auth.uid()))
  with check (public.is_admin() or (public.my_role() = 'murabbi' and author = auth.uid()));
drop policy if exists alumni_posts_delete on public.alumni_posts;
create policy alumni_posts_delete on public.alumni_posts for delete to authenticated
  using (public.is_admin() or (public.my_role() = 'murabbi' and author = auth.uid()));

-- ---------- ลิงก์อัซการ: เปลี่ยนเป็น PubHTML5 ----------
-- ถ้าลิงก์สั้นนี้เปิดไม่ได้ ให้ไปแก้ในแอป: แอดมิน > ลิงก์ (ไม่ต้องรัน SQL ใหม่)
update public.resources
set title = 'อัซการ (หนังสือออนไลน์ PubHTML5)', url = 'https://share.google/rrM6Yyfz2Kj1bKFLW', sort = 0
where category = 'adhkar' and url = 'https://sunnah.com/hisn';

insert into public.resources (category, title, url, sort)
select 'adhkar', 'อัซการ (หนังสือออนไลน์ PubHTML5)', 'https://share.google/rrM6Yyfz2Kj1bKFLW', 0
where not exists (select 1 from public.resources where url = 'https://share.google/rrM6Yyfz2Kj1bKFLW');
