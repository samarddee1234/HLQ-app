import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../supabase.js'
import { REPORT_THRESHOLDS } from '../config.js'
import { academicYearStart, downloadCSV, mondayOf, pct, thaiDate, toBuddhistYear, todayISO } from '../lib.js'
import { useStudents } from './useStudents.js'

const LEVELS = [1, 2, 3, 4, 5]

function suggestion(total, complete) {
  if (!complete) return 'รอกรอกให้ครบ 4 เกณฑ์'
  if (total >= REPORT_THRESHOLDS.up) return 'พร้อมพิจารณาเลื่อนระดับ'
  if (total >= REPORT_THRESHOLDS.hold) return 'คงระดับเดิม'
  return 'ควรติดตามใกล้ชิด'
}

/* รายงานประเมินปลายปี 4 เกณฑ์: อีบาดะฮฺ · มารยาท · การเรียน · การเข้าร่วมกิจกรรม
   อีบาดะฮฺและการเข้าร่วมคำนวณจากข้อมูลที่ครูเช็คไว้ / มารยาทและการเรียนครูให้ระดับ 1–5 */
export default function YearEndReport({ groupId }) {
  const { students, loading } = useStudents(groupId)
  const [from, setFrom] = useState(academicYearStart())
  const [to, setTo] = useState(todayISO())
  const [scores, setScores] = useState([])
  const [att, setAtt] = useState([])
  const [ratings, setRatings] = useState({})
  const [msg, setMsg] = useState('')
  const year = toBuddhistYear(from)

  useEffect(() => {
    if (!students.length) return
    const ids = students.map((s) => s.id)
    let alive = true
    Promise.all([
      supabase.from('weekly_scores').select('student_id,week_start,score,checked')
        .in('student_id', ids).gte('week_start', mondayOf(from)).lte('week_start', to),
      supabase.from('halaqah_attendance').select('student_id,week_start,status')
        .in('student_id', ids).gte('week_start', mondayOf(from)).lte('week_start', to),
      supabase.from('year_end_ratings').select('student_id,akhlaq,study').in('student_id', ids).eq('academic_year', year),
    ]).then(([s, a, r]) => {
      if (!alive) return
      setScores(s.data ?? []); setAtt(a.data ?? [])
      setRatings(Object.fromEntries((r.data ?? []).map((x) => [x.student_id, { akhlaq: x.akhlaq, study: x.study }])))
    })
    return () => { alive = false }
  }, [students, from, to, year])

  async function rate(sid, key, value) {
    const next = { ...(ratings[sid] ?? {}), [key]: value === '' ? null : Number(value) }
    setRatings({ ...ratings, [sid]: next })
    const { error } = await supabase.from('year_end_ratings').upsert({
      student_id: sid, academic_year: year, akhlaq: next.akhlaq ?? null, study: next.study ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'student_id,academic_year' })
    setMsg(error ? error.message : 'บันทึกแล้ว')
  }

  const rows = useMemo(() => students.map((s) => {
    const sc = scores.filter((r) => r.student_id === s.id)
    const ibadah = pct(sc.reduce((a, r) => a + Number(r.score), 0), sc.reduce((a, r) => a + Number(r.checked), 0))
    const at = att.filter((r) => r.student_id === s.id)
    const attend = at.length ? Math.round((at.filter((r) => r.status !== 'absent').length / at.length) * 100) : null
    const r = ratings[s.id] ?? {}
    const manners = r.akhlaq ? r.akhlaq * 20 : null
    const study = r.study ? r.study * 20 : null
    const parts = [ibadah, manners, study, attend].filter((v) => v != null)
    const total = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null
    const complete = parts.length === 4
    return { s, ibadah, attend, manners, study, total, complete, suggest: total == null ? '—' : suggestion(total, complete) }
  }), [students, scores, att, ratings])

  const fmt = (v) => (v == null ? '–' : `${v}`)

  function exportCSV() {
    downloadCSV(`รายงานปลายปี-${year}.csv`, [
      ['ชื่อ', 'ชั้น/ห้อง', 'อีบาดะฮฺ (%)', 'การเข้าร่วมฮาลาเกาะฮฺ (%)', 'มารยาท (1-5)', 'การเรียน (1-5)', 'คะแนนรวม (%)', 'ข้อเสนอแนะเบื้องต้น'],
      ...rows.map((x) => [x.s.full_name, `${x.s.grade ?? ''}/${x.s.class_room ?? ''}`, fmt(x.ibadah), fmt(x.attend),
        ratings[x.s.id]?.akhlaq ?? '', ratings[x.s.id]?.study ?? '', fmt(x.total), x.suggest]),
    ])
  }

  if (!groupId) return <div className="card"><p className="muted">ยังไม่ได้เลือกกลุ่ม</p></div>
  if (loading) return <p className="muted">กำลังโหลด…</p>

  return (
    <section className="card print-area">
      <h3>รายงานประเมินปลายปี {year}</h3>
      <div className="row no-print">
        <label className="field grow">ตั้งแต่<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field grow">ถึง<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <p className="muted print-only">ช่วงข้อมูล {thaiDate(from)} – {thaiDate(to)}</p>
      <p className="muted">
        อีบาดะฮฺ = คะแนนละหมาดที่ครูเช็ค · การเข้าร่วม = สัปดาห์ที่เข้าหรือลา ÷ สัปดาห์ที่เช็ค · มารยาทและการเรียน = ระดับ 1–5 ที่ครูให้ (แปลงเป็นเต็ม 100)
        · คะแนนรวม = ค่าเฉลี่ยของเกณฑ์ที่มีข้อมูล · ข้อเสนอแนะเบื้องต้นใช้เกณฑ์ {REPORT_THRESHOLDS.up}/{REPORT_THRESHOLDS.hold} และเป็นเพียงแนวทางประกอบการพิจารณาของครู ระบบไม่บันทึกระดับกลุ่มของนักเรียน
      </p>
      {students.length === 0 && <p className="muted">ยังไม่มีนักเรียนในกลุ่มนี้</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>ชื่อ</th><th>อีบาดะฮฺ</th><th>เข้าร่วม</th><th>มารยาท</th><th>การเรียน</th><th>รวม</th><th>ข้อเสนอแนะ</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.s.id}>
                <td>{x.s.full_name}</td>
                <td>{fmt(x.ibadah)}</td>
                <td>{fmt(x.attend)}</td>
                {['akhlaq', 'study'].map((k) => (
                  <td key={k}>
                    <select aria-label={k === 'akhlaq' ? `มารยาทของ ${x.s.full_name}` : `การเรียนของ ${x.s.full_name}`}
                      value={ratings[x.s.id]?.[k] ?? ''} onChange={(e) => rate(x.s.id, k, e.target.value)} style={{ minWidth: 64 }}>
                      <option value="">–</option>
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </td>
                ))}
                <td><b>{fmt(x.total)}</b></td>
                <td>{x.suggest}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <p className="msg no-print">{msg}</p>}
      <div className="row no-print">
        <button className="btn small" onClick={exportCSV}>ดาวน์โหลด CSV (เปิดใน Excel)</button>
        <button className="btn ghost small" onClick={() => window.print()}>พิมพ์ / บันทึกเป็น PDF</button>
      </div>
    </section>
  )
}

// ตัวเลือกกลุ่มสำหรับแอดมิน
export function AdminReport() {
  const [groups, setGroups] = useState([])
  const [gid, setGid] = useState('')
  useEffect(() => { supabase.from('groups').select('id,name').order('name').then(({ data }) => setGroups(data ?? [])) }, [])
  return (
    <>
      <section className="card no-print">
        <label className="field">เลือกกลุ่ม
          <select value={gid} onChange={(e) => setGid(e.target.value)}>
            <option value="">— เลือก —</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
      </section>
      {gid && <YearEndReport groupId={Number(gid)} />}
    </>
  )
}
