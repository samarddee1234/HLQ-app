-- =====================================================
-- Halaqah App - Migration 04: แชร์สรุปฮาลาเกาะฮฺให้ศิษย์เก่า
-- รันต่อจาก migration_03.sql (รันซ้ำได้)
-- =====================================================
alter table public.weekly_summaries add column if not exists share_alumni boolean not null default false;

-- ศิษย์เก่าอ่านได้เฉพาะสรุปที่มูร๊อบบีย์ติ๊ก "แชร์ให้ศิษย์เก่า"
drop policy if exists summaries_alumni_read on public.weekly_summaries;
create policy summaries_alumni_read on public.weekly_summaries for select to authenticated
  using (share_alumni and public.my_role() = 'alumni');
