import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { Ring } from '../components/Charts.jsx'
import Topic from '../components/Topic.jsx'
import { addDays, attendanceLabel, calcStreak, firstName, mondayOf, pct, scoreOf, thaiDate, todayISO } from '../lib.js'

// บัญชีที่ลงทะเบียนก่อนมีช่องเพศ ให้เลือกครั้งเดียว (ใช้กำหนดตัวเลือก "รอบเดือน" ของนักเรียนหญิง)
function GenderPrompt({ profile, onSaved }) {
  const save = async (gender) => {
    if (!gender) return
    await supabase.from('profiles').update({ gender }).eq('id', profile.id)
    onSaved()
  }
  return (
    <section className="card">
      <h3>ขอข้อมูลเพิ่มเติมอีกนิด</h3>
      <label className="field">เพศ
        <select value="" onChange={(e) => save(e.target.value)}>
          <option value="">— เลือก —</option>
          <option value="male">มุสลีมีน</option>
          <option value="female">มุสลีมะฮ์</option>
        </select>
      </label>
    </section>
  )
}

export default function Home({ profile, go, onProfileChange }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const thisWeek = mondayOf(todayISO())
      const none = Promise.resolve({ data: [] })
      const [c, t, a, p, tc] = await Promise.all([
        supabase.from('prayer_checks').select('check_date,prayer,status')
          .eq('student_id', profile.id).gte('check_date', addDays(thisWeek, -120)),
        supabase.from('weekly_topics').select('*').eq('week_start', thisWeek).maybeSingle(),
        supabase.from('halaqah_attendance').select('status').eq('student_id', profile.id).eq('week_start', thisWeek).maybeSingle(),
        profile.group_id
          ? supabase.from('group_posts').select('id,title,body,created_at').eq('group_id', profile.group_id)
              .order('created_at', { ascending: false }).limit(2)
          : none,
        profile.group_id
          ? supabase.from('profiles').select('id,full_name,phone,facebook').eq('role', 'murabbi').eq('group_id', profile.group_id)
          : none,
      ])
      if (!alive) return
      setD({
        checks: c.data ?? [], topic: t.data, att: a.data, posts: p.data ?? [], teachers: tc.data ?? [], thisWeek,
      })
    })()
    return () => { alive = false }
  }, [profile.id, profile.group_id])

  if (!d) return <p className="muted">กำลังโหลด…</p>

  const week = d.checks.filter((c) => c.check_date >= d.thisWeek)
  const weekScore = week.reduce((s, c) => s + scoreOf(c.status), 0)
  const weekPct = pct(weekScore, week.length)
  const streak = calcStreak(d.checks)

  return (
    <>
      <section className="card hero">
        <h2>อัสสะลามุอะลัยกุม {firstName(profile.full_name)}</h2>
        <p className="muted">ขอให้เป็นวันที่ดีงามและเต็มไปด้วยความบะรอกะฮฺ</p>
      </section>

      {!profile.gender && <GenderPrompt profile={profile} onSaved={onProfileChange} />}

      <div className="grid2">
        <div className="card stat">
          <b>{streak}</b>
          <span>วันติดต่อกันที่ไม่ขาดละหมาด (สเตรค)</span>
        </div>
        <div className="card">
          <Ring value={weekPct} caption={`คะแนนสัปดาห์นี้ (${week.length} วักตู)`} />
        </div>
      </div>

      <section className="card">
        <h3>หัวข้อฮาลาเกาะฮฺสัปดาห์นี้</h3>
        <Topic topic={d.topic} />
        <p>
          การเข้าฮาลาเกาะฮฺสัปดาห์นี้:{' '}
          {d.att ? <span className={`pill ${d.att.status}`}>{attendanceLabel(d.att.status)}</span> : <span className="muted">ครูยังไม่ได้บันทึก</span>}
        </p>
        <button className="btn ghost small" onClick={() => go('learn')}>ดูสรุปและปฏิทินกิจกรรม</button>
      </section>

      {d.posts.length > 0 && (
        <section className="card">
          <h3>อัปเดตจากกลุ่มของฉัน</h3>
          {d.posts.map((p) => (
            <div key={p.id} className="post">
              {p.title && <b>{p.title}</b>}
              <div>{p.body}</div>
              <span className="muted">{thaiDate(p.created_at.slice(0, 10))}</span>
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h3>ครูประจำกลุ่ม</h3>
        {!profile.group_id && <p className="muted">ยังไม่ได้อยู่ในกลุ่ม กรุณาแจ้งแอดมิน</p>}
        {profile.group_id && d.teachers.length === 0 && <p className="muted">ยังไม่มีครูประจำกลุ่มในระบบ</p>}
        {d.teachers.map((t) => (
          <div key={t.id}>
            <b>{t.full_name}</b>
            {t.phone && <div>โทร: <a href={`tel:${t.phone}`}>{t.phone}</a></div>}
            {t.facebook && <div>Facebook: {t.facebook}</div>}
          </div>
        ))}
      </section>

      <section className="card">
        <h3>มีเรื่องในใจ?</h3>
        <p className="muted">ระบายหรือบอกเล่าได้แบบไม่ระบุตัวตน</p>
        <button className="btn ghost small" onClick={() => go('vent')}>ไปที่ระบายใจ</button>
      </section>
    </>
  )
}
