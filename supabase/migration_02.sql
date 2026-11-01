-- =====================================================
-- Halaqah App - Migration 02
-- รันต่อจาก schema.sql (รันซ้ำได้ ไม่ทำให้ข้อมูลเดิมหาย)
-- วิธีใช้: Supabase > SQL Editor > New query > วางทั้งไฟล์ > Run
-- =====================================================

-- ---------- เพิ่มคอลัมน์ ----------
alter table public.profiles add column if not exists gender text check (gender in ('male','female'));
alter table public.groups   add column if not exists gender text check (gender in ('male','female'));  -- ว่าง = ไม่จำกัด
alter table public.groups   add column if not exists stage  text check (stage in ('ม.ต้น','ม.ปลาย')); -- ว่าง = ไม่จำกัด

-- ---------- ตั้งค่าแอป (เช่น พิกัดเวลาละหมาด) ----------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- หัวข้อฮาลาเกาะฮฺรายสัปดาห์ ----------
create table if not exists public.weekly_topics (
  id bigint generated always as identity primary key,
  term text not null,                       -- เช่น '2/2569'
  week_no int not null,
  session_date date not null,               -- วันที่จัดฮาลาเกาะฮฺ
  week_start date generated always as (session_date - (extract(isodow from session_date)::int - 1)) stored,
  kind text not null default 'lesson' check (kind in ('lesson','exam','lecture','special')),
  title text,                               -- ใช้กับกิจกรรมที่ไม่แยกหัวข้อ เช่น ทดสอบ/บรรยาย
  tadabbur text,                            -- ตะดะบุรอัลกุรอาน
  akhlaq text,                              -- อัดลาก
  fiqh text,                                -- อัลฟิกฮ์
  note text,
  unique (term, week_no)
);
create index if not exists idx_topics_week on public.weekly_topics(week_start);

-- ---------- สรุปฮาลาเกาะฮฺรายสัปดาห์ของแต่ละกลุ่ม (ครูเขียน) ----------
create table if not exists public.weekly_summaries (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  week_start date not null,
  body text not null,
  author uuid default auth.uid() references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique (group_id, week_start)
);

-- ---------- ประกาศ/อัปเดตของกลุ่ม ----------
create table if not exists public.group_posts (
  id bigint generated always as identity primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  title text,
  body text not null,
  author uuid default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now()
);
create index if not exists idx_posts_group on public.group_posts(group_id, created_at desc);

-- ---------- เช็คลิสต์อิบาดะฮฺของนักเรียน (นักเรียนติ๊กเอง) ----------
create table if not exists public.checklist_logs (
  id bigint generated always as identity primary key,
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  log_date date not null,
  item text not null,
  unique (student_id, log_date, item)
);

-- ---------- ข้อความระบายใจแบบไม่ระบุตัวตน ----------
-- ตั้งใจไม่เก็บ user id และ group id เพื่อให้ไม่ระบุตัวตนจริง
create table if not exists public.anonymous_messages (
  id bigint generated always as identity primary key,
  body text not null check (char_length(body) between 1 and 1000),
  topic text,
  status text not null default 'new' check (status in ('new','seen','followed')),
  admin_note text,
  created_at timestamptz not null default now()
);

-- ---------- ลิงก์ (อัซการ / กุรอาน / ดุอา) แอดมินแก้ได้ ----------
create table if not exists public.resources (
  id bigint generated always as identity primary key,
  category text not null check (category in ('adhkar','quran','dua','other')),
  title text not null,
  url text not null,
  sort int not null default 0,
  active boolean not null default true
);

-- ---------- อัปเดตตัวป้องกันการเลื่อนสิทธิ์: ย้ายกลุ่มได้เฉพาะแอดมินหลังลงทะเบียนแล้ว ----------
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
  return new;
end $$;

-- ---------- สถิติรวมของกลุ่ม (ไม่เปิดเผยรายบุคคล) ----------
create or replace function public.group_week_stats(p_group bigint, p_weeks int default 8)
returns table (wk_start date, members int, checked bigint, score numeric, att_present bigint, att_total bigint)
language sql stable security definer set search_path = public as $$
  with today as (select (now() at time zone 'Asia/Bangkok')::date as d),
  wk as (
    select (g)::date as ws
    from today,
         generate_series(
           (today.d - (extract(isodow from today.d)::int - 1) - (p_weeks - 1) * 7)::timestamp,
           (today.d - (extract(isodow from today.d)::int - 1))::timestamp,
           interval '7 days') g
  ),
  mem as (
    select id from public.profiles
    where group_id = p_group and role = 'student' and registered
  ),
  pcs as (
    select date_trunc('week', pc.check_date::timestamp)::date as ws,
           count(*) as n,
           sum(case pc.status when 'on_time' then 1 when 'late' then 0.5
                              when 'excused' then 1 when 'menstruation' then 1 else 0 end) as sc
    from public.prayer_checks pc join mem on mem.id = pc.student_id
    group by 1
  ),
  att as (
    select ha.week_start as ws, count(*) as n, count(*) filter (where ha.status = 'present') as pr
    from public.halaqah_attendance ha join mem on mem.id = ha.student_id
    group by 1
  )
  select wk.ws,
         (select count(*) from mem)::int,
         coalesce(pcs.n, 0)::bigint,
         coalesce(pcs.sc, 0)::numeric,
         coalesce(att.pr, 0)::bigint,
         coalesce(att.n, 0)::bigint
  from wk
  left join pcs on pcs.ws = wk.ws
  left join att on att.ws = wk.ws
  where public.is_admin() or p_group = public.my_group()
  order by wk.ws
$$;
revoke all on function public.group_week_stats(bigint, int) from public, anon;
grant execute on function public.group_week_stats(bigint, int) to authenticated;

-- ---------- Row Level Security ----------
alter table public.app_settings enable row level security;
alter table public.weekly_topics enable row level security;
alter table public.weekly_summaries enable row level security;
alter table public.group_posts enable row level security;
alter table public.checklist_logs enable row level security;
alter table public.anonymous_messages enable row level security;
alter table public.resources enable row level security;

-- อ่านได้ทุกคนที่ล็อกอิน / แก้ได้เฉพาะแอดมิน
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select to authenticated using (true);
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists topics_read on public.weekly_topics;
create policy topics_read on public.weekly_topics for select to authenticated using (true);
drop policy if exists topics_admin on public.weekly_topics;
create policy topics_admin on public.weekly_topics for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists resources_read on public.resources;
create policy resources_read on public.resources for select to authenticated using (true);
drop policy if exists resources_admin on public.resources;
create policy resources_admin on public.resources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- สรุปและประกาศ: สมาชิกกลุ่มอ่านได้ / ครูของกลุ่มและแอดมินเขียนได้
drop policy if exists summaries_read on public.weekly_summaries;
create policy summaries_read on public.weekly_summaries for select to authenticated
  using (public.is_admin() or group_id = public.my_group());
drop policy if exists summaries_write on public.weekly_summaries;
create policy summaries_write on public.weekly_summaries for all to authenticated
  using (public.is_admin() or (public.my_role() = 'murabbi' and group_id = public.my_group()))
  with check (public.is_admin() or (public.my_role() = 'murabbi' and group_id = public.my_group()));

drop policy if exists posts_read on public.group_posts;
create policy posts_read on public.group_posts for select to authenticated
  using (public.is_admin() or group_id = public.my_group());
drop policy if exists posts_write on public.group_posts;
create policy posts_write on public.group_posts for all to authenticated
  using (public.is_admin() or (public.my_role() = 'murabbi' and group_id = public.my_group()))
  with check (public.is_admin() or (public.my_role() = 'murabbi' and group_id = public.my_group()));

-- เช็คลิสต์: นักเรียนจัดการของตัวเอง / ครูของกลุ่มและแอดมินอ่านได้
drop policy if exists checklist_read on public.checklist_logs;
create policy checklist_read on public.checklist_logs for select to authenticated
  using (student_id = auth.uid() or public.is_admin() or public.is_murabbi_of(student_id));
drop policy if exists checklist_write on public.checklist_logs;
create policy checklist_write on public.checklist_logs for all to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());

-- ข้อความนิรนาม: ใครก็ส่งได้ แต่อ่าน/จัดการได้เฉพาะแอดมิน
drop policy if exists anon_insert on public.anonymous_messages;
create policy anon_insert on public.anonymous_messages for insert to authenticated with check (true);
drop policy if exists anon_admin on public.anonymous_messages;
create policy anon_admin on public.anonymous_messages for select to authenticated using (public.is_admin());
drop policy if exists anon_admin_update on public.anonymous_messages;
create policy anon_admin_update on public.anonymous_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------- ข้อมูลตั้งต้น: ลิงก์ ----------
insert into public.resources (category, title, url, sort)
select * from (values
  ('quran','อัลกุรอานออนไลน์ (Quran.com)','https://quran.com',1),
  ('quran','ซูเราะฮฺ อัลฟาติหะฮฺ','https://quran.com/1',2),
  ('quran','ซูเราะฮฺ อัลกะฮฺฟิ','https://quran.com/18',3),
  ('quran','ซูเราะฮฺ ยาซีน','https://quran.com/36',4),
  ('quran','ซูเราะฮฺ อัรเราะห์มาน','https://quran.com/55',5),
  ('quran','ซูเราะฮฺ อัลวากิอะฮฺ','https://quran.com/56',6),
  ('quran','ซูเราะฮฺ อัลมุลก์','https://quran.com/67',7),
  ('adhkar','อัซการ (หนังสือออนไลน์ PubHTML5)','https://share.google/rrM6Yyfz2Kj1bKFLW',0)
) as v(category,title,url,sort)
where not exists (select 1 from public.resources);

-- ---------- ข้อมูลตั้งต้น: ปฏิทินกิจกรรมฮาลาเกาะฮฺ ภาคเรียนที่ 2 ปีการศึกษา 2569 ----------
-- คัดลอกจากรูปตารางที่ถ่ายมา โปรดตรวจความถูกต้อง แก้ไขได้ในหน้าแอดมิน
insert into public.weekly_topics (term, week_no, session_date, kind, title, tadabbur, akhlaq, fiqh, note) values
 ('2/2569', 1,'2026-10-21','special','ฮาลาเกาะฮฺรวม ชี้แจงของแต่ละฝ่าย',null,null,null,null),
 ('2/2569', 2,'2026-10-28','lesson',null,null,'ความสะอาด','บทที่ 29 - การอ่านซิกิรต่าง ๆ หลังละหมาด',null),
 ('2/2569', 3,'2026-11-04','exam','ทดสอบ / ประเมิน',null,null,null,'ม.5 ชาย พบบาบอ'),
 ('2/2569', 4,'2026-11-11','lesson',null,null,'การแต่งกาย','บทที่ 30 - การขอดุอาอ์ (ขอพรจากอัลลอฮฺ)',null),
 ('2/2569', 5,'2026-11-18','exam','ทดสอบ / ประเมิน',null,null,null,'ม.5 หญิง พบบาบอ'),
 ('2/2569', 6,'2026-11-25','lesson',null,null,'ชู้สาว','การอาบน้ำวายิบ',null),
 ('2/2569', 7,'2026-12-02','exam','ทดสอบ / ประเมิน',null,null,null,'ม.4 ชาย พบบาบอ'),
 ('2/2569', 8,'2026-12-09','lecture','บรรยายครั้งที่ 1 เรื่อง อบรมเชิงปฏิบัติการ เรื่องละหมาด',null,null,null,null),
 ('2/2569', 9,'2026-12-16','lesson',null,null,'การเยี่ยมเยียน','การละหมาดฎุฮา',null),
 ('2/2569',10,'2026-12-23','exam','สอบกลางภาคศาสนา',null,null,null,null),
 ('2/2569',11,'2026-12-30','lesson',null,null,'การรักษาเวลา','การละหมาดญาเมาะ ตักดิม-ตะเคร',null),
 ('2/2569',12,'2027-01-06','exam','ทดสอบ / ประเมิน',null,null,null,'ม.4 หญิง พบบาบอ'),
 ('2/2569',13,'2027-01-13','lesson',null,null,'มารยาทในการทำงานร่วมกัน','ละหมาดรอวาติบ',null),
 ('2/2569',14,'2027-01-20','exam','ทดสอบ / ประเมิน',null,null,null,'ม.3 ชาย พบบาบอ'),
 ('2/2569',15,'2027-01-27','lesson',null,null,'ความละอาย','ละหมาดตะฮัจญุด',null),
 ('2/2569',16,'2027-02-03','exam','ทดสอบ / ประเมินโดยฝ่ายตัรบียะฮฺ',null,null,null,'ม.3 หญิง พบบาบอ'),
 ('2/2569',17,'2027-02-10','lecture','บรรยายธรรมครั้งที่ 2 เรื่อง ต้อนรับรอมฎอน',null,null,null,null),
 ('2/2569',18,'2027-02-17','special','ฮาลาเกาะฮฺอัลกุรอาน (ช่วงรอมฎอน)',null,null,null,null),
 ('2/2569',19,'2027-02-24','exam','สอบปลายภาคสามัญ',null,null,null,null),
 ('2/2569',20,'2027-03-03','exam','สอบปลายภาคศาสนา',null,null,null,null)
on conflict (term, week_no) do nothing;
