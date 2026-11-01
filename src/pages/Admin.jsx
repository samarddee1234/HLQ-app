import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { thaiDate } from '../lib.js'
import { AlumniPostsManager } from './Alumni.jsx'
import { AdminReport } from './Report.jsx'
import { parseCSV, downloadCSV } from '../lib.js'

const SUBS = [
  { key: 'users', label: 'ผู้ใช้' },
  { key: 'groups', label: 'กลุ่ม' },
  { key: 'alumni', label: 'ศิษย์เก่า' },
  { key: 'report', label: 'รายงานปลายปี' },
  { key: 'topics', label: 'หัวข้อรายสัปดาห์' },
  { key: 'links', label: 'ลิงก์' },
  { key: 'settings', label: 'ตั้งค่า' },
  { key: 'messages', label: 'ข้อความนิรนาม' },
]

export default function Admin({ profile }) {
  const [sub, setSub] = useState('users')
  return (
    <>
      <div className="chips">
        {SUBS.map((s) => (
          <button key={s.key} className={`chip ${sub === s.key ? 'on' : ''}`} onClick={() => setSub(s.key)}>{s.label}</button>
        ))}
      </div>
      {sub === 'users' && <Users me={profile} />}
      {sub === 'groups' && <Groups />}
      {sub === 'alumni' && <AlumniPostsManager profile={profile} />}
      {sub === 'report' && <AdminReport />}
      {sub === 'topics' && <Topics />}
      {sub === 'links' && <Links />}
      {sub === 'settings' && <Settings />}
      {sub === 'messages' && <Messages />}
    </>
  )
}

/* ---------- ผู้ใช้: อนุมัติครู / ย้ายกลุ่ม ---------- */
function Users({ me }) {
  const [filter, setFilter] = useState('pending')
  const [q, setQ] = useState('')
  const [rows, setRows] = useState(null)
  const [groups, setGroups] = useState([])
  const [msg, setMsg] = useState('')

  async function load() {
    let query = supabase.from('profiles').select('id,email,full_name,role,requested_role,group_id,grade,class_room,registered,batch')
      .order('created_at', { ascending: false }).limit(100)
    if (filter === 'pending') query = query.in('requested_role', ['murabbi', 'alumni']).eq('role', 'student')
    if (filter === 'alumni') query = query.eq('role', 'alumni').order('batch', { ascending: true })
    if (filter === 'nogroup') query = query.is('group_id', null).eq('registered', true).eq('role', 'student')
    const term = q.trim().replace(/[,()%]/g, ' ')
    if (term) query = query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
    const { data, error } = await query
    if (error) setMsg(error.message)
    setRows(data ?? [])
  }
  useEffect(() => { load() }, [filter])
  useEffect(() => {
    supabase.from('groups').select('id,name').order('name').then(({ data }) => setGroups(data ?? []))
  }, [])

  async function update(id, patch) {
    setMsg('')
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    setMsg(error ? error.message : 'บันทึกแล้ว')
    load()
  }

  return (
    <section className="card">
      <h3>ผู้ใช้</h3>
      <div className="chips">
        {[['pending', 'รออนุมัติ (ครู/ศิษย์เก่า)'], ['alumni', 'ศิษย์เก่า (เรียงตามรุ่น)'], ['nogroup', 'นักเรียนที่ยังไม่มีกลุ่ม'], ['all', 'ทั้งหมด']].map(([k, l]) => (
          <button key={k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); load() }}>
        <input className="grow" placeholder="ค้นหาชื่อหรืออีเมล" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn small">ค้นหา</button>
      </form>
      {msg && <p className="msg">{msg}</p>}
      {!rows && <p className="muted">กำลังโหลด…</p>}
      {rows && rows.length === 0 && <p className="muted">ไม่พบรายการ</p>}
      {rows?.map((u) => (
        <div key={u.id} className="post" style={{ whiteSpace: 'normal' }}>
          <b>{u.full_name || '(ยังไม่ลงทะเบียน)'}</b> <span className="tag">{u.role}</span>
          {u.requested_role === 'murabbi' && u.role === 'student' && <span className="tag">ขอเป็นครู</span>}
          {u.requested_role === 'alumni' && u.role === 'student' && <span className="tag">ขอเป็นศิษย์เก่า</span>}
          {u.batch && <span className="tag">รุ่น {u.batch}</span>}
          <div className="muted">{u.email}{u.grade ? ` · ${u.grade}/${u.class_room}` : ''}</div>
          <div className="row">
            <label className="field grow" style={{ margin: 4 }}>บทบาท
              <select value={u.role} disabled={u.id === me.id}
                onChange={(e) => update(u.id, { role: e.target.value })}>
                <option value="student">นักเรียน</option>
                <option value="murabbi">มูร๊อบบีย์</option>
                <option value="alumni">ศิษย์เก่า</option>
                <option value="admin">แอดมิน</option>
              </select>
            </label>
            <label className="field grow" style={{ margin: 4 }}>กลุ่ม
              <select value={u.group_id ?? ''} onChange={(e) => update(u.id, { group_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— ไม่มี —</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </label>
          </div>
        </div>
      ))}
      <p className="muted">แสดงสูงสุด 100 รายการ ใช้ช่องค้นหาเพื่อหาคนที่ต้องการ</p>
    </section>
  )
}

/* ---------- กลุ่มฮาลาเกาะฮฺ ---------- */
function Groups() {
  const [rows, setRows] = useState(null)
  const [draft, setDraft] = useState({ name: '', gender: '', stage: '' })
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('groups').select('*').order('name')
    setRows(data ?? [])
  }
  useEffect(() => { load() }, [])

  const clean = (g) => ({ name: g.name.trim(), gender: g.gender || null, stage: g.stage || null })

  async function save(g) {
    const { error } = await supabase.from('groups').update(clean(g)).eq('id', g.id)
    setMsg(error ? error.message : 'บันทึกแล้ว')
    load()
  }
  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('groups').insert(clean(draft))
    setMsg(error ? error.message : 'เพิ่มกลุ่มแล้ว')
    if (!error) setDraft({ name: '', gender: '', stage: '' })
    load()
  }
  async function remove(g) {
    if (!confirm(`ลบกลุ่ม “${g.name}” ?`)) return
    const { error } = await supabase.from('groups').delete().eq('id', g.id)
    setMsg(error ? 'ลบไม่ได้ เพราะยังมีสมาชิกอยู่ในกลุ่ม ให้ย้ายสมาชิกออกก่อน' : 'ลบแล้ว')
    load()
  }
  const edit = (id, k, v) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)))

  const GenderSel = ({ v, on }) => (
    <select value={v ?? ''} onChange={(e) => on(e.target.value)}>
      <option value="">ทุกเพศ</option><option value="male">ชาย</option><option value="female">หญิง</option>
    </select>
  )
  const StageSel = ({ v, on }) => (
    <select value={v ?? ''} onChange={(e) => on(e.target.value)}>
      <option value="">ทุกช่วงชั้น</option><option value="ม.ต้น">ม.ต้น</option><option value="ม.ปลาย">ม.ปลาย</option>
    </select>
  )

  return (
    <>
      <section className="card">
        <h3>กลุ่มฮาลาเกาะฮฺ</h3>
        <p className="muted">แนะนำให้ตั้งชื่อกลุ่มตามชื่อครูหรือรหัสกลุ่ม ไม่ควรใช้ชื่อระดับกลุ่ม (เช่น กลุ่มใกล้ชิด) เพื่อไม่ให้นักเรียนถูกตีตรา</p>
        {msg && <p className="msg">{msg}</p>}
        {rows?.map((g) => (
          <div key={g.id} className="post" style={{ whiteSpace: 'normal' }}>
            <input value={g.name} onChange={(e) => edit(g.id, 'name', e.target.value)} />
            <div className="row" style={{ marginTop: 6 }}>
              <GenderSel v={g.gender} on={(v) => edit(g.id, 'gender', v)} />
              <StageSel v={g.stage} on={(v) => edit(g.id, 'stage', v)} />
              <button className="btn small" onClick={() => save(g)}>บันทึก</button>
              <button className="btn small danger" onClick={() => remove(g)}>ลบ</button>
            </div>
          </div>
        ))}
      </section>
      <form className="card" onSubmit={add}>
        <h3>เพิ่มกลุ่มใหม่</h3>
        <label className="field">ชื่อกลุ่ม
          <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </label>
        <div className="row">
          <GenderSel v={draft.gender} on={(v) => setDraft({ ...draft, gender: v })} />
          <StageSel v={draft.stage} on={(v) => setDraft({ ...draft, stage: v })} />
        </div>
        <button className="btn" style={{ marginTop: 10 }}>เพิ่มกลุ่ม</button>
      </form>
    </>
  )
}

/* ---------- หัวข้อรายสัปดาห์ ---------- */
const EMPTY_TOPIC = { term: '', week_no: '', session_date: '', kind: 'lesson', title: '', tadabbur: '', akhlaq: '', fiqh: '', note: '' }
const KINDS = [['lesson', 'เรียนรู้'], ['exam', 'ทดสอบ/สอบ'], ['lecture', 'บรรยาย'], ['special', 'กิจกรรมพิเศษ']]

function Topics() {
  const [rows, setRows] = useState(null)
  const [draft, setDraft] = useState(EMPTY_TOPIC)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('weekly_topics').select('*').order('session_date', { ascending: false }).limit(60)
    setRows(data ?? [])
  }
  useEffect(() => { load() }, [])

  const payload = (t) => ({
    term: t.term.trim(), week_no: Number(t.week_no), session_date: t.session_date, kind: t.kind,
    title: t.title?.trim() || null, tadabbur: t.tadabbur?.trim() || null,
    akhlaq: t.akhlaq?.trim() || null, fiqh: t.fiqh?.trim() || null, note: t.note?.trim() || null,
  })
  async function save(t) {
    const { error } = await supabase.from('weekly_topics').update(payload(t)).eq('id', t.id)
    setMsg(error ? error.message : 'บันทึกแล้ว')
    load()
  }
  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('weekly_topics').insert(payload(draft))
    setMsg(error ? error.message : 'เพิ่มสัปดาห์แล้ว')
    if (!error) setDraft(EMPTY_TOPIC)
    load()
  }
  async function remove(t) {
    if (!confirm(`ลบสัปดาห์ที่ ${t.week_no} (${t.term}) ?`)) return
    await supabase.from('weekly_topics').delete().eq('id', t.id)
    load()
  }
  const edit = (id, k, v) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)))

  const Fields = ({ t, on }) => (
    <>
      <div className="row">
        <label className="field grow">ภาคเรียน<input value={t.term} onChange={(e) => on('term', e.target.value)} placeholder="เช่น 2/2569" /></label>
        <label className="field grow">สัปดาห์ที่<input type="number" value={t.week_no} onChange={(e) => on('week_no', e.target.value)} /></label>
      </div>
      <div className="row">
        <label className="field grow">วันที่จัด<input type="date" value={t.session_date} onChange={(e) => on('session_date', e.target.value)} /></label>
        <label className="field grow">ประเภท
          <select value={t.kind} onChange={(e) => on('kind', e.target.value)}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      <label className="field">หัวข้อรวม (ใช้กับสอบ/บรรยาย/กิจกรรมพิเศษ)<input value={t.title ?? ''} onChange={(e) => on('title', e.target.value)} /></label>
      <label className="field">ตะดะบุรอัลกุรอาน<input value={t.tadabbur ?? ''} onChange={(e) => on('tadabbur', e.target.value)} /></label>
      <label className="field">อัดลาก<input value={t.akhlaq ?? ''} onChange={(e) => on('akhlaq', e.target.value)} /></label>
      <label className="field">อัลฟิกฮ์<input value={t.fiqh ?? ''} onChange={(e) => on('fiqh', e.target.value)} /></label>
      <label className="field">หมายเหตุ<input value={t.note ?? ''} onChange={(e) => on('note', e.target.value)} /></label>
    </>
  )

  return (
    <>
      <section className="card">
        <h3>หัวข้อรายสัปดาห์</h3>
        <p className="muted">นักเรียนและครูเห็นหัวข้อตามสัปดาห์ที่วันที่จัดอยู่ในนั้น</p>
        {msg && <p className="msg">{msg}</p>}
        {rows?.map((t) => (
          <details key={t.id}>
            <summary>สัปดาห์ที่ {t.week_no} · {thaiDate(t.session_date)} · {t.title ?? t.akhlaq ?? t.fiqh ?? '—'}</summary>
            <Fields t={t} on={(k, v) => edit(t.id, k, v)} />
            <div className="row">
              <button className="btn small" onClick={() => save(t)}>บันทึก</button>
              <button className="btn small danger" onClick={() => remove(t)}>ลบ</button>
            </div>
          </details>
        ))}
      </section>
      <TopicImport onDone={load} />
      <form className="card" onSubmit={add}>
        <h3>เพิ่มสัปดาห์ใหม่ (เช่น เริ่มภาคเรียนใหม่)</h3>
        <Fields t={draft} on={(k, v) => setDraft({ ...draft, [k]: v })} />
        <button className="btn" disabled={!draft.term || !draft.week_no || !draft.session_date}>เพิ่ม</button>
      </form>
    </>
  )
}

/* ---------- นำเข้าหัวข้อทั้งภาคเรียนจากไฟล์ CSV (บันทึกจาก Excel เป็น CSV UTF-8) ---------- */
const IMPORT_COLS = ['term', 'week_no', 'session_date', 'kind', 'title', 'tadabbur', 'akhlaq', 'fiqh', 'note']
const KIND_ALIAS = { lesson: 'lesson', 'เรียนรู้': 'lesson', exam: 'exam', 'ทดสอบ': 'exam', 'สอบ': 'exam', lecture: 'lecture', 'บรรยาย': 'lecture', special: 'special', 'พิเศษ': 'special' }

// รับ 2026-10-21 หรือ 21/10/2569 (ปี พ.ศ. ถูกแปลงให้)
function normDate(v) {
  const s = String(v ?? '').trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  let y, mo, d
  if (m) [, y, mo, d] = m
  else if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) [, d, mo, y] = m
  else return null
  y = Number(y); if (y > 2400) y -= 543
  const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  // ตรวจด้วย UTC เพื่อไม่ให้เขตเวลาของเครื่องทำให้วันเลื่อน
  const t = new Date(Date.UTC(y, Number(mo) - 1, Number(d)))
  return t.getUTCFullYear() === y && t.getUTCMonth() === Number(mo) - 1 && t.getUTCDate() === Number(d) ? iso : null
}

function TopicImport({ onDone }) {
  const [text, setText] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const parsed = (() => {
    if (!text.trim()) return null
    const table = parseCSV(text)
    const head = table[0]?.map((h) => h.trim().toLowerCase()) ?? []
    const idx = Object.fromEntries(IMPORT_COLS.map((c) => [c, head.indexOf(c)]))
    if (idx.term < 0 || idx.week_no < 0 || idx.session_date < 0) return { fatal: 'แถวแรกต้องเป็นหัวคอลัมน์ และมีอย่างน้อย term, week_no, session_date' }
    const items = table.slice(1).map((r, i) => {
      const get = (c) => (idx[c] >= 0 ? (r[idx[c]] ?? '').trim() : '')
      const kind = KIND_ALIAS[get('kind').toLowerCase()] ?? (get('kind') ? null : 'lesson')
      const date = normDate(get('session_date'))
      const week = Number(get('week_no'))
      const errs = []
      if (!get('term')) errs.push('ไม่มีภาคเรียน')
      if (!Number.isInteger(week) || week < 1) errs.push('สัปดาห์ที่ไม่ถูกต้อง')
      if (!date) errs.push('วันที่ไม่ถูกต้อง')
      if (!kind) errs.push('ประเภทไม่ถูกต้อง')
      return {
        line: i + 2, errs,
        row: { term: get('term'), week_no: week, session_date: date, kind, title: get('title') || null, tadabbur: get('tadabbur') || null,
          akhlaq: get('akhlaq') || null, fiqh: get('fiqh') || null, note: get('note') || null },
      }
    })
    return { items }
  })()
  const bad = parsed?.items?.filter((x) => x.errs.length) ?? []
  const good = parsed?.items?.filter((x) => !x.errs.length) ?? []

  async function readFile(e) {
    const f = e.target.files?.[0]
    if (f) setText(await f.text())
    e.target.value = ''
  }
  async function run() {
    setBusy(true); setMsg('')
    const { error } = await supabase.from('weekly_topics').upsert(good.map((x) => x.row), { onConflict: 'term,week_no' })
    setBusy(false)
    if (error) return setMsg(error.message)
    setMsg(`นำเข้าแล้ว ${good.length} สัปดาห์ (สัปดาห์ที่ซ้ำภาคเรียน+ลำดับเดิมถูกอัปเดต)`)
    setText(''); onDone()
  }
  const template = () => downloadCSV('แม่แบบหัวข้อรายสัปดาห์.csv', [
    IMPORT_COLS,
    ['1/2570', 1, '2027-05-19', 'special', 'ฮาลาเกาะฮฺรวม ปฐมนิเทศ', '', '', '', ''],
    ['1/2570', 2, '2027-05-26', 'lesson', '', 'ตะดะบุรซูเราะฮฺ ...', 'ความซื่อสัตย์', 'บทที่ ...', ''],
  ])

  return (
    <section className="card">
      <h3>นำเข้าหัวข้อทั้งภาคเรียนจากไฟล์</h3>
      <p className="muted">กรอกใน Excel ตามแม่แบบ แล้วบันทึกเป็น <b>CSV UTF-8</b> จากนั้นเลือกไฟล์หรือวางข้อความด้านล่าง (ประเภท: lesson / exam / lecture / special หรือ เรียนรู้ / ทดสอบ / บรรยาย / พิเศษ)</p>
      <div className="row">
        <button className="btn ghost small" onClick={template}>ดาวน์โหลดแม่แบบ</button>
        <label className="btn small" style={{ cursor: 'pointer' }}>เลือกไฟล์ CSV
          <input type="file" accept=".csv,text/csv,.txt" onChange={readFile} style={{ display: 'none' }} />
        </label>
      </div>
      <label className="field">หรือวางข้อมูลที่นี่
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="term,week_no,session_date,kind,title,..." />
      </label>
      {parsed?.fatal && <p className="msg err">{parsed.fatal}</p>}
      {parsed?.items && (
        <>
          <p className="msg">พร้อมนำเข้า {good.length} แถว{bad.length ? ` · มีปัญหา ${bad.length} แถว (จะข้าม)` : ''}</p>
          {bad.map((x) => <p key={x.line} className="msg err">แถวที่ {x.line}: {x.errs.join(', ')}</p>)}
          <button className="btn" disabled={busy || good.length === 0} onClick={run}>นำเข้า {good.length} แถว</button>
        </>
      )}
      {msg && <p className="msg">{msg}</p>}
    </section>
  )
}

/* ---------- ลิงก์ ---------- */
const CAT = [['adhkar', 'อัซการ'], ['quran', 'อัลกุรอาน'], ['dua', 'ดุอา'], ['other', 'อื่น ๆ']]

function Links() {
  const [rows, setRows] = useState(null)
  const [draft, setDraft] = useState({ category: 'adhkar', title: '', url: '', sort: 0 })
  const [msg, setMsg] = useState('')

  async function load() {
    const { data } = await supabase.from('resources').select('*').order('category').order('sort')
    setRows(data ?? [])
  }
  useEffect(() => { load() }, [])
  const edit = (id, k, v) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const clean = (r) => ({ category: r.category, title: r.title.trim(), url: r.url.trim(), sort: Number(r.sort) || 0, active: r.active ?? true })

  async function save(r) {
    const { error } = await supabase.from('resources').update(clean(r)).eq('id', r.id)
    setMsg(error ? error.message : 'บันทึกแล้ว')
    load()
  }
  async function add(e) {
    e.preventDefault()
    const { error } = await supabase.from('resources').insert(clean(draft))
    setMsg(error ? error.message : 'เพิ่มลิงก์แล้ว')
    if (!error) setDraft({ category: draft.category, title: '', url: '', sort: 0 })
    load()
  }
  async function remove(r) {
    if (!confirm(`ลบ “${r.title}” ?`)) return
    await supabase.from('resources').delete().eq('id', r.id)
    load()
  }

  return (
    <>
      <section className="card">
        <h3>ลิงก์อัซการ · อัลกุรอาน · ดุอา</h3>
        <p className="muted">ควรให้ครูหรือผู้รู้ตรวจเนื้อหาของลิงก์ก่อนเผยแพร่ให้นักเรียน</p>
        {msg && <p className="msg">{msg}</p>}
        {rows?.map((r) => (
          <div key={r.id} className="post" style={{ whiteSpace: 'normal' }}>
            <input value={r.title} onChange={(e) => edit(r.id, 'title', e.target.value)} />
            <input style={{ marginTop: 6 }} value={r.url} onChange={(e) => edit(r.id, 'url', e.target.value)} />
            <div className="row" style={{ marginTop: 6 }}>
              <select value={r.category} onChange={(e) => edit(r.id, 'category', e.target.value)}>
                {CAT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
              <input type="number" style={{ width: 80 }} value={r.sort} onChange={(e) => edit(r.id, 'sort', e.target.value)} aria-label="ลำดับ" />
              <label className="row"><input type="checkbox" checked={r.active} onChange={(e) => edit(r.id, 'active', e.target.checked)} /> แสดง</label>
              <button className="btn small" onClick={() => save(r)}>บันทึก</button>
              <button className="btn small danger" onClick={() => remove(r)}>ลบ</button>
            </div>
          </div>
        ))}
      </section>
      <form className="card" onSubmit={add}>
        <h3>เพิ่มลิงก์</h3>
        <label className="field">หมวด
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {CAT.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="field">ชื่อที่แสดง<input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="field">ลิงก์ (https://…)<input required type="url" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></label>
        <button className="btn">เพิ่ม</button>
      </form>
    </>
  )
}

/* ---------- ตั้งค่า: พิกัดเวลาละหมาด ---------- */
const PLACES = [
  ['ปัตตานี', 6.8696, 101.2501], ['ยะลา', 6.5411, 101.2804], ['นราธิวาส', 6.4254, 101.8253],
  ['สงขลา (หาดใหญ่)', 7.0086, 100.4747], ['สตูล', 6.6238, 100.0674], ['กรุงเทพมหานคร', 13.7563, 100.5018],
]
const METHODS = [[3, 'Muslim World League (ค่าเริ่มต้น)'], [11, 'สิงคโปร์ (MUIS)'], [17, 'มาเลเซีย (JAKIM)']]

function Settings() {
  const [cfg, setCfg] = useState({ label: '', lat: '', lng: '', method: 3 })
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'prayer').maybeSingle()
      .then(({ data }) => data?.value && setCfg({ label: '', lat: '', lng: '', method: 3, ...data.value }))
  }, [])

  function pick(e) {
    const p = PLACES.find((x) => x[0] === e.target.value)
    if (p) setCfg({ ...cfg, label: p[0], lat: p[1], lng: p[2] })
  }
  async function save(e) {
    e.preventDefault()
    const value = { label: cfg.label, lat: Number(cfg.lat), lng: Number(cfg.lng), method: Number(cfg.method) }
    const { error } = await supabase.from('app_settings').upsert({ key: 'prayer', value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    setMsg(error ? error.message : 'บันทึกแล้ว')
  }

  return (
    <form className="card" onSubmit={save}>
      <h3>พิกัดสำหรับเวลาละหมาด</h3>
      <label className="field">เลือกจังหวัดที่ใกล้โรงเรียน
        <select value={cfg.label} onChange={pick}>
          <option value="">— เลือก —</option>
          {PLACES.map((p) => <option key={p[0]}>{p[0]}</option>)}
        </select>
      </label>
      <div className="row">
        <label className="field grow">ละติจูด<input required type="number" step="any" value={cfg.lat} onChange={(e) => setCfg({ ...cfg, lat: e.target.value })} /></label>
        <label className="field grow">ลองจิจูด<input required type="number" step="any" value={cfg.lng} onChange={(e) => setCfg({ ...cfg, lng: e.target.value })} /></label>
      </div>
      <label className="field">ชื่อสถานที่ที่แสดง<input value={cfg.label} onChange={(e) => setCfg({ ...cfg, label: e.target.value })} /></label>
      <label className="field">วิธีคำนวณ
        <select value={cfg.method} onChange={(e) => setCfg({ ...cfg, method: e.target.value })}>
          {METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </label>
      <p className="muted">แนะนำให้ใส่พิกัดของโรงเรียนจริง (คัดลอกจาก Google Maps) และเทียบเวลากับตารางของคณะกรรมการอิสลามประจำจังหวัดก่อนใช้งาน</p>
      <button className="btn">บันทึก</button>
      {msg && <p className="msg">{msg}</p>}
    </form>
  )
}

/* ---------- ข้อความนิรนาม ---------- */
function Messages() {
  const [rows, setRows] = useState(null)
  const [msg, setMsg] = useState('')

  async function load() {
    const { data, error } = await supabase.from('anonymous_messages').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) setMsg(error.message)
    setRows(data ?? [])
  }
  useEffect(() => { load() }, [])
  const edit = (id, k, v) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  async function save(r) {
    const { error } = await supabase.from('anonymous_messages').update({ status: r.status, admin_note: r.admin_note || null }).eq('id', r.id)
    setMsg(error ? error.message : 'บันทึกแล้ว')
  }

  return (
    <section className="card">
      <h3>ข้อความนิรนามจากนักเรียน</h3>
      <p className="muted">ควรมอบหมายผู้ดูแลที่เหมาะสม (เช่น ครูแนะแนว) ตรวจทุกวัน หากข้อความสื่อถึงอันตราย ให้ติดตามผ่านครูประจำชั้นหรือครูพี่เลี้ยงโดยไม่เปิดเผยว่าใครเป็นผู้ส่ง</p>
      {msg && <p className="msg">{msg}</p>}
      {rows && rows.length === 0 && <p className="muted">ยังไม่มีข้อความ</p>}
      {rows?.map((r) => (
        <div key={r.id} className="post">
          <div>{r.body}</div>
          <div className="muted">{thaiDate(r.created_at.slice(0, 10))}{r.topic ? ` · ${r.topic}` : ''}</div>
          <div className="row" style={{ marginTop: 6 }}>
            <select style={{ width: 'auto' }} value={r.status} onChange={(e) => edit(r.id, 'status', e.target.value)}>
              <option value="new">ใหม่</option><option value="seen">อ่านแล้ว</option><option value="followed">ติดตามแล้ว</option>
            </select>
            <input className="grow" placeholder="บันทึกของผู้ดูแล" value={r.admin_note ?? ''} onChange={(e) => edit(r.id, 'admin_note', e.target.value)} />
            <button className="btn small" onClick={() => save(r)}>บันทึก</button>
          </div>
        </div>
      ))}
    </section>
  )
}
