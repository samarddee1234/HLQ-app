-- =====================================================
-- migration_07: ข้อมูลกลุ่มสำหรับหน้าลงทะเบียน + เปิด RLS ที่ถูกปิดไว้ (ตาราง groups, profiles)
-- วิธีใช้: Supabase > SQL Editor > New query > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- =====================================================

-- 1) คอลัมน์ของกลุ่ม (ในโปรเจกต์ของคุณมีอยู่แล้ว คำสั่งนี้ไม่ทำอะไรซ้ำ)
alter table public.groups add column if not exists category text;   -- กลุ่มนำ / พัฒนา / ใส่ใจ / ใกล้ชิด
alter table public.groups add column if not exists grade text;      -- ม.1 ... ม.6 (ว่าง = ทุกชั้น)
alter table public.groups add column if not exists murabbi_1 text;  -- ชื่อมูร๊อบบีย์ (แสดงตอนลงทะเบียน)
alter table public.groups add column if not exists murabbi_2 text;

-- 2) นโยบายของ groups: ผู้ล็อกอินอ่านได้ (ใช้ตอนลงทะเบียน) แอดมินจัดการ
drop policy if exists groups_read on public.groups;
create policy groups_read on public.groups for select to authenticated using (true);
drop policy if exists groups_admin on public.groups;
create policy groups_admin on public.groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- 3) เปิด RLS (Supabase แสดง "RLS disabled / UNRESTRICTED" ที่ groups และ profiles
--    แปลว่าใครก็ตามที่มี anon key เรียก API อ่าน/แก้ข้อมูลได้ รวมถึงเปลี่ยน role ตัวเองเป็นแอดมิน)
alter table public.groups enable row level security;

-- profiles: เปิดเฉพาะเมื่อมีนโยบายครบ ไม่งั้นทุกคนจะเข้าแอปไม่ได้
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_read')
     and exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update') then
    alter table public.profiles enable row level security;
    raise notice 'เปิด RLS ของ profiles แล้ว';
  else
    raise warning 'ไม่พบนโยบาย profiles_read/profiles_update จึงยังไม่เปิด RLS ของ profiles ให้รันส่วนนโยบายของ profiles ใน schema.sql ก่อน แล้วรันไฟล์นี้อีกครั้ง';
  end if;
end $$;

-- 4) ตรวจผล: ทุกตารางควรเป็น true
select c.relname as table_name, c.relrowsecurity as rls_on
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- (ไม่บังคับ) จากภาพตาราง groups ดูเหมือนคอลัมน์ stage มีชื่อครูอยู่ ซึ่งซ้ำกับ murabbi_1/2
-- โค้ดใหม่ไม่ใช้ stage แล้ว ถ้าตรวจแล้วว่าซ้ำจริง จะล้างได้ด้วยบรรทัดนี้ (เอา -- ข้างหน้าออกก่อนรัน):
-- update public.groups set stage = null where stage is not null and stage not in ('ม.ต้น','ม.ปลาย');
