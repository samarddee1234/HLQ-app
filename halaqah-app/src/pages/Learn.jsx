import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import Topic from '../components/Topic.jsx'
import About from './About.jsx'
import { addDays, mondayOf, shortDate, thaiDate, todayISO } from '../lib.js'

const SUBS = [
  { key: 'week', label: 'รายสัปดาห์' },
  { key: 'calendar', label: 'ปฏิทินกิจกรรม' },
  { key: 'about', label: 'ฮาลาเกาะฮฺคืออะไร' },
]

export default function Learn({ profile }) {
  const [sub, setSub] = useState('week')
  return (
    <>
      <div className="chips" role="tablist">
        {SUBS.map((s) => (
          <button key={s.key} role="tab" aria-selected={sub === s.key}
            className={`chip ${sub === s.key ? 'on' : ''}`} onClick={() => setSub(s.key)}>{s.label}</button>
        ))}
      </div>
      {sub === 'week' && <Week profile={profile} />}
      {sub === 'calendar' && <Calendar />}
      {sub === 'about' && <About />}
    </>
  )
}

function Week({ profile }) {
  const [week, setWeek] = useState(mondayOf(todayISO()))
  const [d, setD] = useState(null)

  useEffect(() => {
    let alive = true
    setD(null)
    ;(async () => {
      const none = Promise.resolve({ data: null })
      const [t, s, p] = await Promise.all([
        supabase.from('weekly_topics').select('*').eq('week_start', week).maybeSingle(),
        profile.group_id
          ? supabase.from('weekly_summaries').select('body,updated_at').eq('group_id', profile.group_id).eq('week_start', week).maybeSingle()
          : none,
        profile.group_id
          ? supabase.from('group_posts').select('id,title,body,created_at').eq('group_id', profile.group_id)
              .order('created_at', { ascending: false }).limit(10)
          : Promise.resolve({ data: [] }),
      ])
      if (alive) setD({ topic: t.data, summary: s.data, posts: p.data ?? [] })
    })()
    return () => { alive = false }
  }, [week, profile.group_id])

  return (
    <>
      <div className="card row between">
        <button className="btn ghost small" onClick={() => setWeek(addDays(week, -7))}>◀ ก่อนหน้า</button>
        <b>สัปดาห์เริ่ม {thaiDate(week)}</b>
        <button className="btn ghost small" onClick={() => setWeek(addDays(week, 7))}>ถัดไป ▶</button>
      </div>
      {!d ? <p className="muted">กำลังโหลด…</p> : (
        <>
          <section className="card">
            <h3>หัวข้อ</h3>
            <Topic topic={d.topic} />
          </section>
          <section className="card">
            <h3>สรุปฮาลาเกาะฮฺของกลุ่ม</h3>
            {!profile.group_id && <p className="muted">ยังไม่ได้อยู่ในกลุ่ม</p>}
            {profile.group_id && !d.summary && <p className="muted">ครูยังไม่ได้ลงสรุปของสัปดาห์นี้</p>}
            {d.summary && <p className="pre">{d.summary.body}</p>}
          </section>
          {d.posts.length > 0 && (
            <section className="card">
              <h3>ประกาศและอัปเดตของกลุ่ม</h3>
              {d.posts.map((p) => (
                <div key={p.id} className="post">
                  {p.title && <b>{p.title}</b>}
                  <div>{p.body}</div>
                  <span className="muted">{thaiDate(p.created_at.slice(0, 10))}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  )
}

function Calendar() {
  const [rows, setRows] = useState(null)
  const [term, setTerm] = useState('')

  useEffect(() => {
    supabase.from('weekly_topics').select('*').order('session_date').limit(400).then(({ data }) => {
      const list = data ?? []
      setRows(list)
      const today = todayISO()
      const cur = list.find((r) => r.week_start === mondayOf(today)) ?? [...list].reverse().find((r) => r.session_date <= today) ?? list[list.length - 1]
      setTerm(cur?.term ?? '')
    })
  }, [])

  const terms = useMemo(() => [...new Set((rows ?? []).map((r) => r.term))], [rows])
  if (!rows) return <p className="muted">กำลังโหลด…</p>
  if (rows.length === 0) return <div className="card"><p className="muted">ยังไม่มีปฏิทินกิจกรรม แอดมินสามารถเพิ่มได้ในหน้าแอดมิน</p></div>

  const nowWeek = mondayOf(todayISO())
  const list = rows.filter((r) => r.term === term)
  return (
    <section className="card">
      <div className="row between">
        <h3>ปฏิทินกิจกรรมฮาลาเกาะฮฺ</h3>
        {terms.length > 1 && (
          <select style={{ width: 'auto' }} value={term} onChange={(e) => setTerm(e.target.value)}>
            {terms.map((t) => <option key={t} value={t}>ภาคเรียน {t}</option>)}
          </select>
        )}
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>วันที่</th><th>กิจกรรม</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className={r.week_start === nowWeek ? 'now' : ''}>
                <td>{r.week_no}</td>
                <td>{shortDate(r.session_date)}</td>
                <td>
                  {r.title ?? [r.tadabbur, r.akhlaq, r.fiqh].filter(Boolean).join(' · ')}
                  {r.note && <div className="muted">{r.note}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">แถวที่ไฮไลต์คือสัปดาห์ปัจจุบัน</p>
    </section>
  )
}
