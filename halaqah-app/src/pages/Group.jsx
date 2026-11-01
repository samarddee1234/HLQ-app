import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { BarChart } from '../components/Charts.jsx'
import Topic from '../components/Topic.jsx'
import { addDays, mondayOf, pct, shortDate, thaiDate, todayISO, weekRange } from '../lib.js'
import { useStudents } from './useStudents.js'
import { NoGroup } from './PrayerCheck.jsx'
import { AlumniPostsManager } from './Alumni.jsx'

const SUBS = [
  { key: 'members', label: 'สมาชิก' },
  { key: 'summary', label: 'สรุปสัปดาห์' },
  { key: 'posts', label: 'ประกาศ' },
  { key: 'alumni', label: 'โพสต์ศิษย์เก่า' },
  { key: 'contact', label: 'ข้อมูลติดต่อฉัน' },
]

export default function Group({ profile, onProfileChange }) {
  const [sub, setSub] = useState('members')
  if (!profile.group_id) return <NoGroup />
  return (
    <>
      <div className="chips">
        {SUBS.map((s) => (
          <button key={s.key} className={`chip ${sub === s.key ? 'on' : ''}`} onClick={() => setSub(s.key)}>{s.label}</button>
        ))}
      </div>
      {sub === 'members' && <Members profile={profile} />}
      {sub === 'summary' && <Summary profile={profile} />}
      {sub === 'posts' && <Posts profile={profile} />}
      {sub === 'alumni' && <AlumniPostsManager profile={profile} />}
      {sub === 'contact' && <Contact profile={profile} onSaved={onProfileChange} />}
    </>
  )
}

/* ---------- สมาชิก + คะแนนรายสัปดาห์รายบุคคล ---------- */
function Members({ profile }) {
  const { students, loading } = useStudents(profile.group_id)
  const [scores, setScores] = useState([])
  const [sel, setSel] = useState(null)
  const weeks = weekRange(8)

  useEffect(() => {
    if (!students.length) return
    supabase.from('weekly_scores').select('student_id,week_start,score,checked')
      .in('student_id', students.map((s) => s.id)).gte('week_start', weeks[0])
      .then(({ data }) => setScores(data ?? []))
  }, [students])

  if (loading) return <p className="muted">กำลังโหลด…</p>
  if (!students.length) return <div className="card"><p className="muted">ยังไม่มีนักเรียนที่ลงทะเบียนในกลุ่มนี้</p></div>

  const cell = (sid, w) => scores.find((r) => r.student_id === sid && r.week_start === w)
  const nowWeek = mondayOf(todayISO())
  const avg4 = (sid) => {
    const rows = scores.filter((r) => r.student_id === sid && r.week_start >= weeks[4])
    return pct(rows.reduce((s, r) => s + Number(r.score), 0), rows.reduce((s, r) => s + Number(r.checked), 0))
  }
  const show = (v) => (v == null ? '–' : `${v}%`)
  const picked = students.find((s) => s.id === sel)

  return (
    <>
      <section className="card">
        <h3>สมาชิกกลุ่ม ({students.length})</h3>
        <p className="muted">แตะชื่อเพื่อดูกราฟรายสัปดาห์ของนักเรียนคนนั้น</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ชื่อ</th><th>ชั้น</th><th>สัปดาห์นี้</th><th>4 สัปดาห์</th></tr></thead>
            <tbody>
              {students.map((s) => {
                const c = cell(s.id, nowWeek)
                return (
                  <tr key={s.id} className={`clickable ${sel === s.id ? 'sel' : ''}`} onClick={() => setSel(sel === s.id ? null : s.id)}>
                    <td>{s.full_name}</td>
                    <td>{s.grade}/{s.class_room}</td>
                    <td>{show(c ? pct(c.score, c.checked) : null)}</td>
                    <td>{show(avg4(s.id))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      {picked && (
        <section className="card">
          <h3>{picked.full_name}</h3>
          <BarChart label={`คะแนนรายสัปดาห์ของ ${picked.full_name}`}
            data={weeks.map((w) => {
              const c = cell(picked.id, w)
              return { label: shortDate(w), value: c ? pct(c.score, c.checked) : null, current: w === nowWeek }
            })} />
        </section>
      )}
    </>
  )
}

/* ---------- สรุปฮาลาเกาะฮฺรายสัปดาห์ ---------- */
function Summary({ profile }) {
  const [week, setWeek] = useState(mondayOf(todayISO()))
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState(null)
  const [share, setShare] = useState(false)
  const [msg, setMsg] = useState('')

 useEffect(() => {
  if (!profile.group_id) return
  Promise.all([
    supabase.from('weekly_summaries').select('body,share_alumni').eq('group_id', profile.group_id).eq('week_start', week).maybeSingle(),
    supabase.from('weekly_topics').select('*').eq('week_start', week).maybeSingle(),
  ]).then(([s, t]) => { setBody(s.data?.body ?? ''); setShare(!!s.data?.share_alumni); setTopic(t.data) })
}, [profile.group_id, week])
  async function save() {
    setMsg('')
   const { error } = await supabase.from('weekly_summaries').upsert({
  group_id: profile.group_id, week_start: week, body: body.trim(), share_alumni: share, updated_at: new Date().toISOString(),
}, { onConflict: 'group_id,week_start' })
setMsg(error ? error.message : share ? 'บันทึกแล้ว นักเรียนในกลุ่มและศิษย์เก่าทุกรุ่นจะเห็นสรุปนี้' : 'บันทึกแล้ว นักเรียนในกลุ่มจะเห็นสรุปนี้')
  }

  return (
    <section className="card">
      <h3>สรุปฮาลาเกาะฮฺของกลุ่ม</h3>
      <div className="row between">
        <button className="btn ghost small" onClick={() => setWeek(addDays(week, -7))}>◀</button>
        <b>สัปดาห์เริ่ม {thaiDate(week)}</b>
        <button className="btn ghost small" onClick={() => setWeek(addDays(week, 7))}>▶</button>
      </div>
      <div style={{ marginTop: 10 }}><Topic topic={topic} compact /></div>
      <label className="field">สรุปสิ่งที่ได้เรียนรู้ ข้อตกลง หรือการบ้านของสัปดาห์นี้
        <textarea value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <label className="field">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
        แบ่งปันสรุปนี้กับศิษย์เก่า
      </label>
      <label className="check-row" style={{ cursor: 'pointer' }}>
  <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
  <span>แชร์สรุปนี้ให้ศิษย์เก่าอ่านด้วย
    <span className="muted" style={{ display: 'block' }}>โปรดอย่าใส่ชื่อนักเรียนหรือเรื่องส่วนตัวในสรุปที่แชร์</span>
  </span>
</label>
<button className="btn" disabled={!body.trim()} onClick={save}>บันทึกสรุป</button>
  )
}

/* ---------- ประกาศ/อัปเดตของกลุ่ม ---------- */
function Posts({ profile }) {
  const [posts, setPosts] = useState(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('group_posts').select('id,title,body,created_at')
      .eq('group_id', profile.group_id).order('created_at', { ascending: false }).limit(30)
    setPosts(data ?? [])
  }
  useEffect(() => { load() }, [profile.group_id])

  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('group_posts').insert({
      group_id: profile.group_id, title: title.trim() || null, body: body.trim(),
    })
    if (error) return setMsg(error.message)
    setTitle(''); setBody(''); setMsg('โพสต์แล้ว'); load()
  }
  async function remove(id) {
    if (!confirm('ลบประกาศนี้?')) return
    await supabase.from('group_posts').delete().eq('id', id)
    load()
  }

  return (
    <>
      <form className="card" onSubmit={add}>
        <h3>ประกาศถึงกลุ่ม</h3>
        <label className="field">หัวข้อ (ไม่บังคับ)
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">ข้อความ
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <button className="btn" disabled={!body.trim()}>โพสต์</button>
        {msg && <p className="msg">{msg}</p>}
      </form>
      <section className="card">
        <h3>ที่โพสต์ไปแล้ว</h3>
        {!posts && <p className="muted">กำลังโหลด…</p>}
        {posts && posts.length === 0 && <p className="muted">ยังไม่มีประกาศ</p>}
        {posts?.map((p) => (
          <div key={p.id} className="post">
            {p.title && <b>{p.title}</b>}
            <div>{p.body}</div>
            <div className="row">
              <span className="muted">{thaiDate(p.created_at.slice(0, 10))}</span>
              <button className="btn link" onClick={() => remove(p.id)}>ลบ</button>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}

/* ---------- เบอร์ติดต่อ / Facebook ของครู ---------- */
function Contact({ profile, onSaved }) {
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [facebook, setFacebook] = useState(profile.facebook ?? '')
  const [msg, setMsg] = useState('')

  async function save(e) {
    e.preventDefault()
    const { error } = await supabase.from('profiles')
      .update({ phone: phone.trim() || null, facebook: facebook.trim() || null }).eq('id', profile.id)
    setMsg(error ? error.message : 'บันทึกแล้ว นักเรียนในกลุ่มจะเห็นข้อมูลนี้')
    if (!error) onSaved()
  }

  return (
    <form className="card" onSubmit={save}>
      <h3>ข้อมูลติดต่อของฉัน</h3>
      <p className="muted">นักเรียนในกลุ่มของคุณจะเห็นข้อมูลนี้ ใส่เฉพาะช่องทางที่สะดวกให้ติดต่อ</p>
      <label className="field">เบอร์โทร<input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></label>
      <label className="field">Facebook<input value={facebook} onChange={(e) => setFacebook(e.target.value)} /></label>
      <button className="btn">บันทึก</button>
      {msg && <p className="msg">{msg}</p>}
    </form>
  )
}
