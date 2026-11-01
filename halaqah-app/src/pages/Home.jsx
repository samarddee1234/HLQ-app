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
          <option value="male">ชาย</option>
          <option value="female">หญิง</option>
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
        <p className="muted">ขอให้เป็นวันที่ดีและเต็มไปด้วยความบะรอกะฮฺ</p>
      </section>

      {!profile.gender && <GenderPrompt profile={profile} onSaved={onProfileChange} />}

      <div className="grid2">
        {/* การ์ดไฟสะสมสไตล์ Duolingo */}
        <div className="card stat" style={{
          background: streak > 0 ? 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)' : '#f8fafc',
          border: `2px solid ${streak > 0 ? '#fb923c' : '#cbd5e1'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '50%',
            background: streak > 0 ? '#ea580c' : '#94a3b8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '8px',
            boxShadow: streak > 0 ? '0 0 14px rgba(234, 88, 12, 0.5)' : 'none'
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#ffffff">
              <path d="M12 2C9.5 6 7 8.5 7 12.5C7 16.09 9.91 19 13.5 19C17.09 19 20 16.09 20 12.5C20 10.5 19 8.5 17.5 7C17.5 9 16 10.5 14.5 10.5C13 10.5 12 9 12 6.5V2ZM13.5 22C8.81 22 5 18.19 5 13.5C5 9.5 8 5.5 12 2C12 2 13 4.5 15 6.5C16.5 5 17 3.5 17 3.5C20 6.5 22 9.8 22 13.5C22 18.19 18.19 22 13.5 22Z"/>
            </svg>
          </div>
          <b style={{ color: streak > 0 ? '#c2410c' : '#64748b', fontSize: '24px' }}>{streak}</b>
          <span style={{ color: streak > 0 ? '#9a3412' : '#64748b', fontSize: '13px', textAlign: 'center' }}>
            {streak > 0 ? 'วันติดต่อกัน (ไฟติด! 🔥)' : 'วันติดต่อกัน (ไฟดับ ✕)'}
          </span>
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
