import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { BarChart } from '../components/Charts.jsx'
import Topic from '../components/Topic.jsx'
import { firstName, mondayOf, pct, shortDate, todayISO, weekRange } from '../lib.js'
import { useStudents } from './useStudents.js'
import { NoGroup } from './PrayerCheck.jsx'

const WEEKS = 8

export default function MHome({ profile, go }) {
  const { students, loading } = useStudents(profile.group_id)
  const [d, setD] = useState(null)

  useEffect(() => {
    if (!profile.group_id) return
    let alive = true
    ;(async () => {
      const [g, t, st] = await Promise.all([
        supabase.from('groups').select('name').eq('id', profile.group_id).maybeSingle(),
        supabase.from('weekly_topics').select('*').eq('week_start', mondayOf(todayISO())).maybeSingle(),
        supabase.rpc('group_week_stats', { p_group: profile.group_id, p_weeks: WEEKS }),
      ])
      if (alive) setD({ group: g.data, topic: t.data, stats: st.data ?? [], serr: st.error })
    })()
    return () => { alive = false }
  }, [profile.group_id])

  // วันนี้ใครยังไม่ถูกเช็ค
  const [today, setToday] = useState(null)
  useEffect(() => {
    if (!students.length) return
    supabase.from('prayer_checks').select('student_id,prayer').eq('check_date', todayISO())
      .in('student_id', students.map((s) => s.id))
      .then(({ data }) => setToday(data ?? []))
  }, [students])

  if (!profile.group_id) return <NoGroup />
  if (loading || !d) return <p className="muted">กำลังโหลด…</p>

  const weeks = weekRange(WEEKS)
  const byWeek = Object.fromEntries(d.stats.map((r) => [r.wk_start, r]))
  const nowWeek = mondayOf(todayISO())
  const bars = weeks.map((w) => ({
    label: shortDate(w), current: w === nowWeek,
    value: byWeek[w] ? pct(byWeek[w].score, byWeek[w].checked) : null,
  }))
  const thisWeek = byWeek[nowWeek]
  const avgNow = thisWeek ? pct(thisWeek.score, thisWeek.checked) : null
  const unchecked = today ? students.filter((s) => (today.filter((r) => r.student_id === s.id).length) < 2) : []

  return (
    <>
      <section className="card hero">
        <h2>อัสสะลามุอะลัยกุม {firstName(profile.full_name)}</h2>
        <p>{d.group?.name ?? 'กลุ่มของฉัน'} · นักเรียน {students.length} คน</p>
        <div className="row">
          <button className="btn light" onClick={() => go('prayer')}>เช็คละหมาดวันนี้</button>
          <button className="btn light" onClick={() => go('attend')}>เช็คเข้าฮาลาเกาะฮฺ</button>
        </div>
      </section>

      <div className="grid2">
        <div className="card stat">
          <b>{avgNow == null ? '–' : `${avgNow}%`}</b>
          <span>คะแนนเฉลี่ยกลุ่มสัปดาห์นี้</span>
        </div>
        <div className="card stat">
          <b>{thisWeek ? `${thisWeek.att_present}/${thisWeek.att_total}` : '–'}</b>
          <span>เข้าฮาลาเกาะฮฺสัปดาห์นี้ (เข้าร่วม/ที่บันทึกแล้ว)</span>
        </div>
      </div>

      <section className="card">
        <h3>คะแนนละหมาดเฉลี่ยของกลุ่มรายสัปดาห์</h3>
        {d.serr
          ? <p className="muted">ยังดึงสถิติไม่ได้ (แอดมินต้องรัน migration_02.sql ก่อน)</p>
          : <BarChart data={bars} label="คะแนนละหมาดเฉลี่ยของกลุ่มรายสัปดาห์" />}
      </section>

      <section className="card">
        <h3>วันนี้ยังเช็คไม่ครบ</h3>
        {today == null && <p className="muted">กำลังโหลด…</p>}
        {today && unchecked.length === 0 && <p>เช็คครบทุกคนแล้ว 🎉</p>}
        {today && unchecked.length > 0 && (
          <p>{unchecked.map((s) => s.full_name).join(', ')}</p>
        )}
      </section>

      <section className="card">
        <h3>หัวข้อสัปดาห์นี้</h3>
        <Topic topic={d.topic} />
      </section>
    </>
  )
}
