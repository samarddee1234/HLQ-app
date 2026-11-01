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
      <InstallApp />
      <PrayerTimes />
      <HijriCalendar />
      <Links />
      <Dhikr />
    </>
  )
}

/* ---------- ติดตั้งแอปลงหน้าจอ (PWA) ---------- */
function InstallApp() {
  const [evt, setEvt] = useState(null)
  const standalone = typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone)
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setEvt(e) }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  if (standalone) return null
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return (
    <section className="card">
      <h3>ติดตั้งแอปลงหน้าจอมือถือ</h3>
      {evt && (
        <button className="btn" onClick={async () => { evt.prompt(); await evt.userChoice; setEvt(null) }}>ติดตั้งแอป</button>
      )}
      {!evt && ios && <p className="muted">บน iPhone/iPad: กดปุ่มแชร์ของ Safari แล้วเลือก "เพิ่มไปยังหน้าจอโฮม"</p>}
      {!evt && !ios && <p className="muted">บน Android: เปิดเมนูของ Chrome แล้วเลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก" (ปุ่มจะขึ้นที่นี่เองถ้าเบราว์เซอร์รองรับ)</p>}
    </section>
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

/* ---------- ตัวนับซิกรุลลอฮฺ (ป๊อปอัป) ---------- */
const TARGETS = [33, 99, 100]
const PHRASES = [
  { key: 'tasbih', ar: 'سُبْحَانَ اللّٰهِ', th: 'สุบฮานัลลอฮฺ' },
  { key: 'tahmid', ar: 'الْحَمْدُ لِلّٰهِ', th: 'อัลฮัมดุลิลลาฮฺ' },
  { key: 'takbir', ar: 'اللّٰهُ أَكْبَرُ', th: 'อัลลอฮุอักบัร' },
  { key: 'tahlil', ar: 'لَا إِلٰهَ إِلَّا اللّٰهُ', th: 'ลาอิลาฮะ อิลลัลลอฮฺ' },
  { key: 'istighfar', ar: 'أَسْتَغْفِرُ اللّٰهَ', th: 'อัสตัฆฟิรุลลอฮฺ' },
]

function readNum(key, fallback) {
  try { return Number(localStorage.getItem(key)) || fallback } catch { return fallback }
}

function Dhikr() {
  const [open, setOpen] = useState(false)
  const total = readNum('dhikr-count', 0)
  return (
    <section className="card dhikr-card">
      <h3>ซิกรุลลอฮฺ</h3>
      <p className="muted">กดนับซิกิรได้ง่าย ๆ ในหน้าต่างเล็ก ๆ ที่เปิดแล้วสบายตา</p>
      <button className="btn" onClick={() => setOpen(true)}>🌙 เปิดตัวนับซิกิร</button>
      {open && <DhikrModal onClose={() => setOpen(false)} />}
      {!open && total > 0 && <p className="muted" style={{ marginTop: 8 }}>ค้างไว้ที่ {total} ครั้ง</p>}
    </section>
  )
}

function DhikrModal({ onClose }) {
  const [count, setCount] = useState(() => readNum('dhikr-count', 0))
  const [target, setTarget] = useState(() => readNum('dhikr-target', 33))
  const [phrase, setPhrase] = useState(() => {
    try { return localStorage.getItem('dhikr-phrase') || PHRASES[0].key } catch { return PHRASES[0].key }
  })
  const [bump, setBump] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('dhikr-count', String(count))
      localStorage.setItem('dhikr-target', String(target))
      localStorage.setItem('dhikr-phrase', phrase)
    } catch { /* ignore */ }
  }, [count, target, phrase])

  // ปิดด้วยปุ่ม Esc และล็อกการเลื่อนหน้าเบื้องหลัง
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => setDone(false), 2200)
    return () => clearTimeout(t)
  }, [done])

  const cur = PHRASES.find((p) => p.key === phrase) ?? PHRASES[0]
  const inRound = count % target
  const progress = inRound / target
  const R = 92
  const C = 2 * Math.PI * R

  function tap() {
    const next = count + 1
    setCount(next)
    setBump((b) => b + 1)
    if (next % target === 0) {
      setDone(true)
      try { navigator.vibrate?.([120, 60, 120]) } catch { /* ignore */ }
    } else {
      try { navigator.vibrate?.(15) } catch { /* ignore */ }
    }
  }

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="ตัวนับซิกรุลลอฮฺ" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <h3 style={{ margin: 0 }}>ซิกรุลลอฮฺ ✨</h3>
          <button className="modal-x" onClick={onClose} aria-label="ปิด" autoFocus>✕</button>
        </div>

        <div className="chips phrase-chips">
          {PHRASES.map((p) => (
            <button key={p.key} className={`chip ${phrase === p.key ? 'on' : ''}`} onClick={() => setPhrase(p.key)}>{p.th}</button>
          ))}
        </div>
        <p className="arabic dhikr-ar" lang="ar">{cur.ar}</p>

        <div className="dhikr-ring">
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r={R} className="dr-bg" />
            <circle cx="110" cy="110" r={R} className="dr-fg" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 110 110)" />
          </svg>
          <button className="dhikr-tap" onClick={tap} aria-label={`นับเพิ่ม ตอนนี้ ${inRound} จาก ${target}`}>
            <span key={bump} className="dhikr-num">{inRound}</span>
            <small>จาก {target}</small>
          </button>
          {done && <div className="dhikr-party" role="status">🎉 มาชาอัลลอฮฺ ครบ {target} แล้ว</div>}
        </div>

        <div className="chips" style={{ justifyContent: 'center' }}>
          {TARGETS.map((t) => (
            <button key={t} className={`chip ${target === t ? 'on' : ''}`} onClick={() => setTarget(t)}>ครบ {t}</button>
          ))}
        </div>
        <div className="row between">
          <span className="muted">รอบที่ {Math.floor(count / target)} · รวม {count} ครั้ง</span>
          <button className="btn ghost small" onClick={() => { setCount(0); setDone(false) }}>เริ่มใหม่</button>
        </div>
      </div>
    </div>
  )
}
