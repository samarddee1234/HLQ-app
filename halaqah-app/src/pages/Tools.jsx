import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { hijriOf, thaiDate, todayISO, toISO } from '../lib.js'

const CATS = [
  { key: 'adhkar', label: 'อัซการ' },
  { key: 'quran', label: 'อัลกุรอาน' },
  { key: 'dua', label: 'ดุอา' },
  { key: 'other', label: 'อื่น ๆ' },
]

export default function Tools() {
  return (
    <>
      <PrayerTimes />
      <HijriCalendar />
      <Links />
      <Dhikr />
    </>
  )
}

/* ---------- เวลาละหมาด (Aladhan API) ---------- */
const TIME_NAMES = [
  ['Fajr', 'ศุบฮิ'], ['Sunrise', 'อาทิตย์ขึ้น'], ['Dhuhr', 'ซุฮรี'],
  ['Asr', 'อัสรี'], ['Maghrib', 'มัฆริบ'], ['Isha', 'อิชาอ์'],
]

function PrayerTimes() {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'prayer').maybeSingle()
      const cfg = data?.value
      if (!cfg?.lat || !cfg?.lng) return alive && setState({ missing: true })
      const day = todayISO()
      const cacheKey = `ptimes:${day}:${cfg.lat},${cfg.lng},${cfg.method ?? 3}`
      try {
        const cached = localStorage.getItem(cacheKey)
        if (cached) return alive && setState({ cfg, timings: JSON.parse(cached) })
      } catch { /* ไม่มี storage ก็ข้ามไป */ }
      try {
        const [y, m, d] = day.split('-')
        const url = `https://api.aladhan.com/v1/timings/${d}-${m}-${y}?latitude=${cfg.lat}&longitude=${cfg.lng}&method=${cfg.method ?? 3}`
        const res = await fetch(url)
        const json = await res.json()
        const timings = json?.data?.timings
        if (!timings) throw new Error('no timings')
        try { localStorage.setItem(cacheKey, JSON.stringify(timings)) } catch { /* ignore */ }
        if (alive) setState({ cfg, timings })
      } catch {
        if (alive) setState({ cfg, failed: true })
      }
    })()
    return () => { alive = false }
  }, [])

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m }
  let nextKey = null
  if (state.timings) {
    const upcoming = TIME_NAMES.filter(([k]) => k !== 'Sunrise').find(([k]) => toMin(state.timings[k]) > nowMin)
    nextKey = (upcoming ?? TIME_NAMES[0])[0]
  }

  return (
    <section className="card">
      <h3>เวลาละหมาดวันนี้</h3>
      {state.loading && <p className="muted">กำลังโหลด…</p>}
      {state.missing && <p className="muted">แอดมินยังไม่ได้ตั้งค่าพิกัดสำหรับเวลาละหมาด (หน้าแอดมิน &gt; ตั้งค่า)</p>}
      {state.failed && <p className="muted">โหลดเวลาละหมาดไม่ได้ในตอนนี้ ลองใหม่ภายหลัง</p>}
      {state.timings && (
        <>
          <p className="muted">{state.cfg.label ? `พื้นที่: ${state.cfg.label} · ` : ''}{thaiDate(todayISO())}</p>
          <div className="time-grid">
            {TIME_NAMES.map(([k, th]) => (
              <div key={k} className={k === nextKey ? 'next' : ''}>
                <span>{th}</span>
                <b>{String(state.timings[k]).slice(0, 5)}</b>
              </div>
            ))}
          </div>
          <p className="muted">เป็นเวลาคำนวณโดยประมาณ โปรดยึดตามประกาศของโรงเรียน/คณะกรรมการอิสลามประจำจังหวัด</p>
        </>
      )}
    </section>
  )
}

/* ---------- ปฏิทินฮิจเราะฮฺ ---------- */
const DOW = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

function HijriCalendar() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const today = todayISO()
  const h = hijriOf(new Date())
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const lead = (new Date(year, month, 1).getDay() + 6) % 7
  const days = new Date(year, month + 1, 0).getDate()
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const title = cursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })

  return (
    <section className="card">
      <h3>ปฏิทินฮิจเราะฮฺ</h3>
      {h && <p><b>วันนี้ {h.day} {h.monthName} {h.year}</b></p>}
      <div className="row between">
        <button className="btn ghost small" onClick={() => setCursor(new Date(year, month - 1, 1))}>◀</button>
        <b>{title}</b>
        <button className="btn ghost small" onClick={() => setCursor(new Date(year, month + 1, 1))}>▶</button>
      </div>
      <div className="cal" style={{ marginTop: 8 }}>
        {DOW.map((d) => <div key={d} className="h">{d}</div>)}
        {cells.map((n, i) => {
          if (!n) return <div key={i} className="d blank" />
          const date = new Date(year, month, n)
          const hj = hijriOf(date)
          return (
            <div key={i} className={`d ${toISO(date) === today ? 'today' : ''}`}>
              {n}<small>{hj ? hj.day : ''}</small>
            </div>
          )
        })}
      </div>
      <p className="muted">ตัวเลขเล็กคือวันที่ฮิจเราะฮฺตามปฏิทินอุมมุลกุรอ อาจต่างจากประกาศของจุฬาราชมนตรี 1 วัน โดยเฉพาะต้นเดือน/รอมฎอน/อีด</p>
    </section>
  )
}

/* ---------- ลิงก์อัซการ / กุรอาน / ดุอา ---------- */
function Links() {
  const [items, setItems] = useState(null)
  useEffect(() => {
    supabase.from('resources').select('*').eq('active', true).order('sort').then(({ data }) => setItems(data ?? []))
  }, [])
  if (!items) return null
  return (
    <section className="card">
      <h3>อัซการ · อัลกุรอาน · ดุอา</h3>
      {items.length === 0 && <p className="muted">ยังไม่มีลิงก์ แอดมินเพิ่มได้ในหน้าแอดมิน</p>}
      {CATS.map((c) => {
        const list = items.filter((i) => i.category === c.key)
        if (!list.length) return null
        return (
          <div key={c.key}>
            <h3 style={{ marginTop: 10 }}>{c.label}</h3>
            <div className="links">
              {list.map((i) => (
                <a key={i.id} href={i.url} target="_blank" rel="noopener noreferrer">{i.title}</a>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}

/* ---------- ตัวนับซิกรุลลอฮฺ ---------- */
const TARGETS = [33, 99, 100]

function Dhikr() {
  const [count, setCount] = useState(() => {
    try { return Number(localStorage.getItem('dhikr-count')) || 0 } catch { return 0 }
  })
  const [target, setTarget] = useState(33)
  useEffect(() => {
    try { localStorage.setItem('dhikr-count', String(count)) } catch { /* ignore */ }
  }, [count])

  function tap() {
    const next = count + 1
    setCount(next)
    try { if (next % target === 0) navigator.vibrate?.(200) } catch { /* ignore */ }
  }

  return (
    <section className="card">
      <h3>ซิกรุลลอฮฺ</h3>
      <div className="chips">
        {TARGETS.map((t) => (
          <button key={t} className={`chip ${target === t ? 'on' : ''}`} onClick={() => setTarget(t)}>ครบ {t}</button>
        ))}
      </div>
      <button className="big-count" onClick={tap} aria-label="นับเพิ่ม">{count}</button>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="muted">รอบที่ {Math.floor(count / target)} · เหลืออีก {target - (count % target)} ครั้งจะครบ</span>
        <button className="btn ghost small" onClick={() => setCount(0)}>เริ่มใหม่</button>
      </div>
    </section>
  )
}
