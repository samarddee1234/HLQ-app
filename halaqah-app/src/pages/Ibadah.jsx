import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { BarChart } from '../components/Charts.jsx'
import { IBADAH_ITEMS, addDays, shortDate, todayISO } from '../lib.js'

export default function Ibadah({ profile }) {
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [logs, setLogs] = useState([]) // [{log_date, item}]
  const [err, setErr] = useState('')

  async function load() {
    const { data, error } = await supabase.from('checklist_logs').select('log_date,item')
      .eq('student_id', profile.id).gte('log_date', addDays(today, -6))
    if (error) setErr('โหลดเช็คลิสต์ไม่ได้ (แอดมินต้องรัน migration_02.sql ก่อน)')
    setLogs(data ?? [])
  }
  useEffect(() => { load() }, [profile.id])

  const done = (day, item) => logs.some((l) => l.log_date === day && l.item === item)

  async function toggle(item) {
    setErr('')
    const on = done(date, item)
    // อัปเดตหน้าจอก่อน แล้วค่อยบันทึก
    setLogs((ls) => on
      ? ls.filter((l) => !(l.log_date === date && l.item === item))
      : [...ls, { log_date: date, item }])
    const { error } = on
      ? await supabase.from('checklist_logs').delete().eq('student_id', profile.id).eq('log_date', date).eq('item', item)
      : await supabase.from('checklist_logs').upsert({ student_id: profile.id, log_date: date, item }, { onConflict: 'student_id,log_date,item' })
    if (error) { setErr(error.message); load() }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const chart = days.map((day) => ({
    label: shortDate(day),
    value: Math.round((IBADAH_ITEMS.filter((it) => done(day, it.key)).length / IBADAH_ITEMS.length) * 100),
    current: day === date,
  }))
  const countToday = IBADAH_ITEMS.filter((it) => done(date, it.key)).length

  return (
    <>
      <section className="card">
        <div className="row between">
          <h3>เช็คลิสต์อิบาดะฮฺประจำวัน</h3>
          <input type="date" style={{ width: 'auto' }} value={date} max={today} min={addDays(today, -6)}
            onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
        <p className="muted">ติ๊กเองได้เลย เป็นการตรวจสอบตนเอง ไม่ได้นำไปคิดคะแนนละหมาด</p>
        {IBADAH_ITEMS.map((it) => (
          <label key={it.key} className="check-row">
            <input type="checkbox" checked={done(date, it.key)} onChange={() => toggle(it.key)} />
            <span>{it.label}</span>
          </label>
        ))}
        <p><b>วันนี้ทำได้ {countToday} / {IBADAH_ITEMS.length}</b></p>
        {err && <p className="msg err">{err}</p>}
      </section>

      <section className="card">
        <h3>7 วันที่ผ่านมา</h3>
        <BarChart data={chart} label="เปอร์เซ็นต์เช็คลิสต์อิบาดะฮฺ 7 วัน" />
      </section>
    </>
  )
}
