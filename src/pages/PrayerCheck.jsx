import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { PRAYERS, addDays, statusesFor, thaiDate, todayISO } from '../lib.js'
import { useStudents } from './useStudents.js'

// มูร๊อบบีย์เช็คซุฮรี/อัสรี ของนักเรียนในกลุ่มตัวเองเท่านั้น (RLS บังคับอีกชั้นที่ฐานข้อมูล)
export default function PrayerCheck({ profile }) {
  const { students, error, loading } = useStudents(profile.group_id)
  const [date, setDate] = useState(todayISO())
  const [values, setValues] = useState({}) // `${studentId}|${prayer}` -> status
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!students.length) return
    setMsg('')
    supabase.from('prayer_checks').select('student_id,prayer,status')
      .eq('check_date', date).in('student_id', students.map((s) => s.id))
      .then(({ data }) => {
        const v = {}
        for (const r of data ?? []) v[`${r.student_id}|${r.prayer}`] = r.status
        setValues(v)
      })
  }, [date, students])

  if (!profile.group_id) return <NoGroup />
  if (loading) return <p className="muted">กำลังโหลด…</p>
  if (error) return <p className="msg err">{error}</p>
  if (!students.length) return <div className="card"><p className="muted">ยังไม่มีนักเรียนที่ลงทะเบียนในกลุ่มนี้</p></div>

  const setVal = (sid, prayer, status) => setValues((v) => ({ ...v, [`${sid}|${prayer}`]: status }))

  function fillEmpty(prayer, status) {
    setValues((v) => {
      const n = { ...v }
      for (const s of students) if (!n[`${s.id}|${prayer}`]) n[`${s.id}|${prayer}`] = status
      return n
    })
  }

  async function save() {
    setBusy(true)
    setMsg('')
    const rows = Object.entries(values).filter(([, st]) => st).map(([k, status]) => {
      const [student_id, prayer] = k.split('|')
      return { student_id, prayer, status, check_date: date, updated_at: new Date().toISOString() }
    })
    const { error: e } = await supabase.from('prayer_checks').upsert(rows, { onConflict: 'student_id,check_date,prayer' })
    setBusy(false)
    setMsg(e ? e.message : `บันทึกแล้ว ${rows.length} รายการ`)
  }

  const done = Object.values(values).filter(Boolean).length

  return (
    <section className="card">
      <h3>เช็คละหมาดซุฮรี–อัสรี</h3>
      <div className="row between">
        <div className="row">
          <button className="btn ghost small" onClick={() => setDate(addDays(date, -1))}>◀</button>
          <input type="date" style={{ width: 'auto' }} value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn ghost small" disabled={date >= todayISO()} onClick={() => setDate(addDays(date, 1))}>▶</button>
        </div>
        <span className="muted">{thaiDate(date)}</span>
      </div>
      <div className="row" style={{ margin: '10px 0' }}>
        <button className="btn ghost small" onClick={() => fillEmpty('zuhr', 'on_time')}>ซุฮรี: ทัน (ช่องที่ว่าง)</button>
        <button className="btn ghost small" onClick={() => fillEmpty('asr', 'on_time')}>อัสรี: ทัน (ช่องที่ว่าง)</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ชื่อ</th>{PRAYERS.map((p) => <th key={p.key}>{p.label}</th>)}</tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.full_name}</td>
                {PRAYERS.map((p) => (
                  <td key={p.key}>
                    <select aria-label={`${s.full_name} ${p.label}`} value={values[`${s.id}|${p.key}`] ?? ''}
                      onChange={(e) => setVal(s.id, p.key, e.target.value)}>
                      <option value="">—</option>
                      {statusesFor(s.gender).map((st) => <option key={st.key} value={st.key}>{st.label}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row between">
        <button className="btn" onClick={save} disabled={busy}>บันทึก</button>
        <span className="muted">กรอกแล้ว {done} / {students.length * PRAYERS.length}</span>
      </div>
      {msg && <p className="msg">{msg}</p>}
      <p className="muted">ทันเวลา 1 · สาย 0.5 · ไม่ขึ้น 0 · ลากิจ/ป่วย 1 · รอบเดือน (นักเรียนหญิง) 1 คะแนนต่อวักตู</p>
    </section>
  )
}

export function NoGroup() {
  return (
    <div className="card">
      <p>บัญชีนี้ยังไม่ได้ถูกกำหนดกลุ่ม กรุณาให้แอดมินตั้งกลุ่มให้ก่อน</p>
    </div>
  )
}
