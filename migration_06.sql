-- =====================================================
-- migration_06: ช่องระบายใจแบบตอบกลับได้ + ส่งถึงมูร๊อบบีย์กลุ่ม
-- วิธีใช้: Supabase > SQL Editor > New query > วางทั้งไฟล์ > Run (รันซ้ำได้)
-- แนวคิด: ไม่เก็บ user id เลย เก็บเพียง "รหัสลับ" ที่สุ่มในเครื่องนักเรียน
--         ถ้านักเรียนเลือกส่งถึงมูร๊อบบีย์ จะเก็บ group_id (รู้แค่ว่ามาจากกลุ่มไหน ไม่รู้ว่าใคร)
-- =====================================================

alter table public.anonymous_messages add column if not exists audience text not null default 'admin';
alter table public.anonymous_messages add column if not exists group_id bigint references public.groups(id) on delete set null;
alter table public.anonymous_messages add column if not exists mood text;
alter table public.anonymous_messages add column if not exists reply text;
alter table public.anonymous_messages add column if not exists replied_at timestamptz;
alter table public.anonymous_messages add column if not exists reply_token text;

alter table public.anonymous_messages drop constraint if exists anon_audience_chk;
alter table public.anonymous_messages add constraint anon_audience_chk
  check (audience in ('admin','group') and ((audience = 'group') = (group_id is not null)));
alter table public.anonymous_messages drop constraint if exists anon_mood_chk;
alter table public.anonymous_messages add constraint anon_mood_chk check (mood is null or char_length(mood) <= 20);
alter table public.anonymous_messages drop constraint if exists anon_reply_chk;
alter table public.anonymous_messages add constraint anon_reply_chk check (reply is null or char_length(reply) <= 2000);

create index if not exists idx_anon_token on public.anonymous_messages(reply_token);
create index if not exists idx_anon_group on public.anonymous_messages(group_id, status);

-- ส่งได้: ต้องมีรหัสลับ, ห้ามใส่คำตอบ/สถานะเอง, ส่งถึงกลุ่มได้เฉพาะ "กลุ่มของตัวเอง"
drop policy if exists anon_insert on public.anonymous_messages;
create policy anon_insert on public.anonymous_messages for insert to authenticated
  with check (
    reply is null and replied_at is null and status = 'new' and admin_note is null
    and char_length(coalesce(reply_token, '')) between 24 and 64
    and (
      (audience = 'admin' and group_id is null)
      or (audience = 'group' and group_id is not null and group_id = public.my_group())
    )
  );

-- อ่าน: แอดมินอ่านได้ทั้งหมด (เดิม) / มูร๊อบบีย์อ่านได้เฉพาะที่ส่งถึงกลุ่มตัวเอง
drop policy if exists anon_murabbi_read on public.anonymous_messages;
create policy anon_murabbi_read on public.anonymous_messages for select to authenticated
  using (public.my_role() = 'murabbi' and audience = 'group' and group_id is not null and group_id = public.my_group());

-- จัดการ/ตอบกลับ: ผ่านฟังก์ชันนี้เท่านั้น (มูร๊อบบีย์แก้ได้แค่สถานะ บันทึก และคำตอบ แก้เนื้อหาไม่ได้)
create or replace function public.vent_manage(p_id bigint, p_status text, p_note text, p_reply text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.anonymous_messages;
begin
  select * into m from public.anonymous_messages where id = p_id;
  if not found then raise exception 'ไม่พบข้อความ'; end if;
  if not (public.is_admin() or (public.my_role() = 'murabbi' and m.audience = 'group' and m.group_id = public.my_group())) then
    raise exception 'ไม่มีสิทธิ์จัดการข้อความนี้';
  end if;
  if p_status not in ('new','seen','followed') then raise exception 'สถานะไม่ถูกต้อง'; end if;
  if p_reply is not null and char_length(p_reply) > 2000 then raise exception 'คำตอบยาวเกินไป'; end if;
  update public.anonymous_messages set
    status = p_status,
    admin_note = nullif(trim(coalesce(p_note, '')), ''),
    reply = case when p_reply is null then reply else nullif(trim(p_reply), '') end,
    replied_at = case when p_reply is null then replied_at
                      when nullif(trim(p_reply), '') is null then null else now() end
  where id = p_id;
end $$;
revoke all on function public.vent_manage(bigint, text, text, text) from public, anon;
grant execute on function public.vent_manage(bigint, text, text, text) to authenticated;

-- นักเรียนดูข้อความของตัวเองด้วยรหัสลับที่เก็บในเครื่อง
create or replace function public.my_vent_replies(p_tokens text[])
returns table (reply_token text, body text, topic text, created_at timestamptz, reply text, replied_at timestamptz, audience text)
language sql stable security definer set search_path = public as $$
  select m.reply_token, m.body, m.topic, m.created_at, m.reply, m.replied_at, m.audience
  from public.anonymous_messages m
  where cardinality(p_tokens) between 1 and 50 and m.reply_token = any(p_tokens)
  order by m.created_at desc
$$;
revoke all on function public.my_vent_replies(text[]) from public, anon;
grant execute on function public.my_vent_replies(text[]) to authenticated;

-- นโยบายเก็บรักษา: แอดมินลบข้อความเก่าได้ (เช่น เก่ากว่า 180 วัน)
create or replace function public.vent_purge(p_days int)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_admin() then raise exception 'เฉพาะแอดมิน'; end if;
  if p_days < 30 then raise exception 'ต้องไม่น้อยกว่า 30 วัน'; end if;
  delete from public.anonymous_messages where created_at < now() - make_interval(days => p_days);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.vent_purge(int) from public, anon;
grant execute on function public.vent_purge(int) to authenticated;

-- ตรวจผล (ควรเห็นนโยบาย anon_insert, anon_admin, anon_admin_update, anon_murabbi_read เท่านั้น ไม่มี select ที่เปิดให้ทุกคน)
-- select policyname, cmd, qual from pg_policies where tablename = 'anonymous_messages';
