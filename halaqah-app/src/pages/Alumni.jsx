import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { thaiDate, todayISO, toISO } from '../lib.js'

export const POST_KINDS = [
  { key: 'knowledge', label: 'ความรู้จากมูร๊อบบีย์' },
  { key: 'announcement', label: 'ประกาศ' },
  { key: 'online_halaqah', label: 'ฮาลาเกาะฮฺออนไลน์' },
  { key: 'reunion', label: 'งานรวมตัวศิษย์เก่า' },
]
const kindLabel = (k) => POST_KINDS.find((x) => x.key === k)?.label ?? k
const needsDate = (k) => k === 'online_halaqah' || k === 'reunion'

const timeOf = (iso) =>
  new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'
const dayOf = (iso) => toISO(new Date(iso))

/* =====================================================
   หน้าแรกของศิษย์เก่า: แจ้งเตือนวันนี้ + ประกาศ + นัดหมาย
   ===================================================== */
export function AlumniHome({ profile, go }) {
  const [posts, setPosts] = useState(null)
  const [mates, setMates] = useState([])
  const [perm, setPerm] = useState(() => (typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'))

  useEffect(() => {
    supabase.from('alumni_posts').select('id,kind,title,body,event_at,batch,created_at')
      .order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => setPosts(data ?? []))
    supabase.rpc('batch_mates').then(({ data }) => setMates(data ?? []))
  }, [])

  const today = todayISO()
  const todays = useMemo(
    () => (posts ?? []).filter((p) => p.kind === 'online_halaqah' && p.event_at && dayOf(p.event_at) === today),
    [posts, today],
  )
  const upcoming = useMemo(
    () => (posts ?? [])
      .filter((p) => needsDate(p.kind) && p.event_at && dayOf(p.event_at) >= today && !todays.includes(p))
      .sort((a, b) => a.event_at.localeCompare(b.event_at)),
    [posts, today, todays],
  )
  const news = (posts ?? []).filter((p) => p.kind === 'announcement').slice(0, 5)

  // แจ้งเตือนของเบราว์เซอร์ (เด้งตอนเปิดแอป วันละครั้งต่อนัด) — ไม่ใช่ push ตอนปิดแอป
  useEffect(() => {
    if (perm !== 'granted' || todays.length === 0) return
    for (const p of todays) {
      const key = `alumni-notified:${p.id}:${today}`
      try {
        if (localStorage.getItem(key)) continue
        localStorage.setItem(key, '1')
      } catch { /* ไม่มี storage ก็แจ้งซ้ำได้ ไม่เป็นไร */ }
      try { new Notification('วันนี้มีฮาลาเกาะฮฺออนไลน์', { body: `${p.title} · ${timeOf(p.event_at)}` }) } catch { /* ignore */ }
    }
  }, [perm, todays, today])

  async function askPermission() {
    try { setPerm(await Notification.requestPermission()) } catch { /* ignore */ }
  }

  return (
    <>
      <section className="card hero">
        <h2>สวัสดี {profile.full_name}</h2>
        <p className="muted">ศิษย์เก่า รุ่นที่ {profile.batch ?? '—'} · สายใยสามารถดี</p>
      </section>

      {todays.map((p) => (
        <section key={p.id} className="card today-alert" role="alert">
          <h3>วันนี้มีฮาลาเกาะฮฺออนไลน์</h3>
          <p><b>{p.title}</b></p>
          <p>เวลา {timeOf(p.event_at)}</p>
          {p.body && <p className="pre">{p.body}</p>}
          <p className="muted">นี่เป็นการแจ้งเตือนเท่านั้น ห้องประชุมอยู่ในแอปประชุมออนไลน์ที่ใช้กันตามปกติ</p>
        </section>
      ))}

      {perm === 'default' && (
        <section className="card">
          <h3>แจ้งเตือนบนเครื่องนี้</h3>
          <p className="muted">เปิดไว้แล้ว เมื่อเข้าแอปในวันที่มีฮาลาเกาะฮฺออนไลน์ จะมีข้อความเด้งเตือน (ยังไม่ใช่การแจ้งเตือนตอนปิดแอป)</p>
          <button className="btn small" onClick={askPermission}>เปิดการแจ้งเตือน</button>
        </section>
      )}

      <section className="card">
        <h3>นัดหมายที่จะถึง</h3>
        {!posts && <p className="muted">กำลังโหลด…</p>}
        {posts && upcoming.length === 0 && <p className="muted">ยังไม่มีนัดหมายใหม่</p>}
        {upcoming.map((p) => (
          <div key={p.id} className="post">
            <span className="tag">{kindLabel(p.kind)}</span> <b>{p.title}</b>
            <div className="muted">{thaiDate(dayOf(p.event_at))} · {timeOf(p.event_at)}{p.batch ? ` · เฉพาะรุ่น ${p.batch}` : ''}</div>
            {p.body && <div>{p.body}</div>}
          </div>
        ))}
      </section>

      <section className="card">
        <h3>ประกาศล่าสุด</h3>
        {posts && news.length === 0 && <p className="muted">ยังไม่มีประกาศ</p>}
        {news.map((p) => (
          <div key={p.id} className="post">
            <b>{p.title}</b>
            {p.body && <div>{p.body}</div>}
            <span className="muted">{thaiDate(dayOf(p.created_at))}{p.batch ? ` · เฉพาะรุ่น ${p.batch}` : ''}</span>
          </div>
        ))}
      </section>

      <section className="card">
        <h3>เพื่อนรุ่น {profile.batch ?? ''}</h3>
        {mates.length === 0 && <p className="muted">ยังไม่มีเพื่อนรุ่นเดียวกันที่ลงทะเบียนในแอป</p>}
        {mates.length > 0 && (
          <div className="chips">
            {mates.map((m, i) => <span key={i} className="tag">{m.full_name}</span>)}
          </div>
        )}
      </section>

      <button className="btn ghost" onClick={() => go('knowledge')}>อ่านความรู้จากมูร๊อบบีย์ →</button>
    </>
  )
}

/* =====================================================
   ภาพรวมความรู้: โพสต์จากมูร๊อบบีย์ + หัวข้อของภาคเรียน
   ===================================================== */
export function AlumniKnowledge() {
  const [posts, setPosts] = useState(null)
  const [topics, setTopics] = useState([])

  useEffect(() => {
    supabase.from('alumni_posts').select('id,title,body,created_at,batch')
      .eq('kind', 'knowledge').order('created_at', { ascending: false }).limit(50)
      .then(({ data }) => setPosts(data ?? []))
    supabase.from('weekly_topics').select('id,week_no,session_date,kind,title,akhlaq,fiqh,tadabbur')
      .order('session_date').then(({ data }) => setTopics(data ?? []))
  }, [])

  return (
    <>
      <section className="card">
        <h3>ความรู้จากมูร๊อบบีย์</h3>
        {!posts && <p className="muted">กำลังโหลด…</p>}
        {posts && posts.length === 0 && <p className="muted">ยังไม่มีโพสต์ มูร๊อบบีย์จะมาแบ่งปันที่นี่</p>}
        {posts?.map((p) => (
          <details key={p.id} className="know">
            <summary>{p.title} <span className="muted">· {thaiDate(dayOf(p.created_at))}</span></summary>
            <p className="pre">{p.body}</p>
          </details>
        ))}
      </section>

      <section className="card">
        <h3>หัวข้อฮาลาเกาะฮฺภาคเรียนปัจจุบัน</h3>
        {topics.length === 0 && <p className="muted">ยังไม่มีข้อมูลหัวข้อ</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>สัปดาห์</th><th>วันที่</th><th>หัวข้อ</th></tr></thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.id}>
                  <td>{t.week_no}</td>
                  <td>{thaiDate(t.session_date)}</td>
                  <td>{t.title || [t.akhlaq && `อัดลาก: ${t.akhlaq}`, t.fiqh && `ฟิกฮ์: ${t.fiqh}`, t.tadabbur && `ตะดะบุร: ${t.tadabbur}`].filter(Boolean).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

/* =====================================================
   ช่องทางติดต่อมูร๊อบบีย์ทุกคน
   ===================================================== */
export function AlumniTeachers() {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    supabase.rpc('murabbi_contacts').then(({ data, error }) => {
      if (error) setErr(error.message)
      setRows(data ?? [])
    })
  }, [])

  return (
    <section className="card">
      <h3>ติดต่อมูร๊อบบีย์</h3>
      {err && <p className="msg err">{err}</p>}
      {!rows && <p className="muted">กำลังโหลด…</p>}
      {rows && rows.length === 0 && <p className="muted">ยังไม่มีข้อมูลมูร๊อบบีย์</p>}
      {rows?.map((t, i) => (
        <div key={i} className="post" style={{ whiteSpace: 'normal' }}>
          <b>{t.full_name}</b> {t.group_name && <span className="tag">{t.group_name}</span>}
          <div>
            {t.phone ? <a href={`tel:${t.phone.replace(/[^\d+]/g, '')}`}>โทร {t.phone}</a> : <span className="muted">ไม่ได้ระบุเบอร์</span>}
          </div>
          <div>
            {!t.facebook && <span className="muted">ไม่ได้ระบุ Facebook</span>}
            {t.facebook && (/^https?:\/\//i.test(t.facebook)
              ? <a href={t.facebook} target="_blank" rel="noopener noreferrer">Facebook</a>
              : <>Facebook: {t.facebook}</>)}
          </div>
        </div>
      ))}
    </section>
  )
}

/* =====================================================
   ตัวจัดการโพสต์ศิษย์เก่า (ใช้ในหน้า "กลุ่มของฉัน" ของมูร๊อบบีย์ และหน้าแอดมิน)
   ===================================================== */
export function AlumniPostsManager({ profile }) {
  const isAdmin = profile.role === 'admin'
  const [posts, setPosts] = useState(null)
  const [kind, setKind] = useState(isAdmin ? 'announcement' : 'knowledge')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [when, setWhen] = useState('')
  const [batch, setBatch] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('alumni_posts')
      .select('id,kind,title,body,event_at,batch,created_at,author')
      .order('created_at', { ascending: false }).limit(40)
    setPosts(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setMsg('')
    if (needsDate(kind) && !when) return setMsg('กรุณาเลือกวันและเวลา')
    const b = batch.trim() === '' ? null : Number(batch)
    if (b !== null && (!Number.isInteger(b) || b < 1 || b > 999)) return setMsg('เลขรุ่นต้องเป็นตัวเลข 1–999')
    setBusy(true)
    const { error } = await supabase.from('alumni_posts').insert({
      kind, title: title.trim(), body: body.trim() || null,
      event_at: needsDate(kind) ? new Date(when).toISOString() : null,
      batch: b,
    })
    setBusy(false)
    if (error) return setMsg(error.message)
    setTitle(''); setBody(''); setWhen(''); setBatch(''); setMsg('โพสต์แล้ว'); load()
  }
  async function remove(id) {
    if (!confirm('ลบโพสต์นี้?')) return
    const { error } = await supabase.from('alumni_posts').delete().eq('id', id)
    if (error) setMsg(error.message)
    load()
  }

  return (
    <>
      <form className="card" onSubmit={add}>
        <h3>โพสต์ถึงศิษย์เก่า</h3>
        <label className="field">ประเภท
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            {POST_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
        </label>
        <label className="field">หัวข้อ
          <input required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">รายละเอียด{kind === 'knowledge' ? '' : ' (ไม่บังคับ)'}
          <textarea required={kind === 'knowledge'} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {needsDate(kind) && (
          <label className="field">วันและเวลา
            <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
        )}
        <label className="field">เฉพาะรุ่นที่ (เว้นว่าง = ทุกรุ่น)
          <input inputMode="numeric" value={batch} onChange={(e) => setBatch(e.target.value.replace(/\D/g, ''))} placeholder="เช่น 27" />
        </label>
        {kind === 'online_halaqah' && (
          <p className="muted">ศิษย์เก่าจะเห็นแจ้งเตือน "วันนี้มีฮาลาเกาะฮฺออนไลน์" ในวันที่เลือก (ถ้าต้องการให้เห็นลิงก์ห้องประชุม ให้พิมพ์ในรายละเอียด)</p>
        )}
        <button className="btn" disabled={busy || !title.trim()}>โพสต์</button>
        {msg && <p className="msg">{msg}</p>}
      </form>

      <section className="card">
        <h3>โพสต์ล่าสุด</h3>
        {!posts && <p className="muted">กำลังโหลด…</p>}
        {posts && posts.length === 0 && <p className="muted">ยังไม่มีโพสต์</p>}
        {posts?.map((p) => (
          <div key={p.id} className="post">
            <span className="tag">{kindLabel(p.kind)}</span> <b>{p.title}</b>
            {p.event_at && <div className="muted">{thaiDate(dayOf(p.event_at))} · {timeOf(p.event_at)}</div>}
            {p.body && <div>{p.body}</div>}
            <div className="row">
              <span className="muted">{thaiDate(dayOf(p.created_at))}{p.batch ? ` · รุ่น ${p.batch}` : ' · ทุกรุ่น'}</span>
              {(isAdmin || p.author === profile.id) && <button type="button" className="btn link" onClick={() => remove(p.id)}>ลบ</button>}
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
