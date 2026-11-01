import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import Topic from '../components/Topic.jsx'
import { ATTENDANCE, addDays, mondayOf, thaiDate, todayISO } from '../lib.js'
import { useStudents } from './useStudents.js'
import { NoGroup } from './PrayerCheck.jsx'

// เช็คการเข้าฮาลาเกาะฮฺรายสัปดาห์ของนักเรียนในกลุ่มตัวเอง
export default function Attendance({ profile }) {
  const { students, error, loading } = useStudents(profile.group_id)
  const [week, setWeek] = useState(mondayOf(todayISO()))
  const [values, setValues] = useState({})
  const [topic, setTopic] = useState(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('weekly_topics').select('*').eq('week_start', week).maybeSingle().then(({ data }) => setTopic(data))
  }, [week])

  useEffect(() => {
    if (!students.length) return
    setMsg('')
    supabase.from('halaqah_attendance').select('student_id,status')
      .eq('week_start', week).in('student_id', students.map((s) => s.id))
      .then(({ data }) => {
        const v = {}
        for (const r of data ?? []) v[r.student_id] = r.status
        setValues(v)
      })
  }, [week, students])

  if (!profile.group_id) return <NoGroup />
  if (loading) return <p className="muted">กำลังโหลด…</p>
  if (error) return <p className="msg err">{error}</p>
  if (!students.length) return <div className="card"><p className="muted">ยังไม่มีนักเรียนที่ลงทะเบียนในกลุ่มนี้</p></div>

  async function save() {
    const rows = Object.entries(values).filter(([, s]) => s).map(([student_id, status]) => ({
      student_id, status, week_start: week, updated_at: new Date().toISOString(),
    }))
    const { error: e } = await supabase.from('halaqah_attendance').upsert(rows, { onConflict: 'student_id,week_start' })
    setMsg(e ? e.message : `บันทึกแล้ว ${rows.length} รายการ`)
  }

  const allPresent = () => setValues((v) => {
    const n = { ...v }
    for (const s of students) if (!n[s.id]) n[s.id] = 'present'
    return n
  })
  const summary = ATTENDANCE.map((a) => `${a.label} ${Object.values(values).filter((x) => x === a.key).length}`).join(' · ')

  return (
    <>
      <section className="card">
        <h3>เช็คการเข้าฮาลาเกาะฮฺ</h3>
        <div className="row between">
          <button className="btn ghost small" onClick={() => setWeek(addDays(week, -7))}>◀</button>
          <b>สัปดาห์เริ่ม {thaiDate(week)}</b>
          <button className="btn ghost small" onClick={() => setWeek(addDays(week, 7))}>▶</button>
        </div>
        <div style={{ marginTop: 10 }}><Topic topic={topic} compact /></div>
      </section>
      <section className="card">
        <button className="btn ghost small" onClick={allPresent}>เข้าร่วม (ช่องที่ว่างทั้งหมด)</button>
        <div className="table-wrap">
          <table>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  <td>
                    <select aria-label={s.full_name} value={values[s.id] ?? ''} onChange={(e) => setValues({ ...values, [s.id]: e.target.value })}>
                      <option value="">—</option>
                      {ATTENDANCE.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row between">
          <button className="btn" onClick={save}>บันทึก</button>
          <span className="muted">{summary}</span>
        </div>
        {msg && <p className="msg">{msg}</p>}
      </section>
    </>
  )
}
