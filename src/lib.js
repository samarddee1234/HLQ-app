// ---------- สถานะละหมาด และคะแนน ----------
export const PRAYERS = [
  { key: 'zuhr', label: 'ซุฮรี' },
  { key: 'asr', label: 'อัสรี' },
]

// short = ข้อความบนปุ่มตอนเช็คชื่อ, label = ข้อความเต็ม
export const STATUSES = [
  { key: 'on_time', label: 'ทันเวลา', short: 'ทัน', score: 1 },
  { key: 'late', label: 'สาย', short: 'สาย', score: 0.5 },
  { key: 'absent', label: 'ไม่ขึ้น', short: 'ไม่ขึ้น', score: 0 },
  { key: 'excused', label: 'ลากิจ/ป่วย', short: 'ลา', score: 1 },
  { key: 'menstruation', label: 'รอบเดือน', short: 'รอบเดือน', score: 1 },
]

export const statusScore = (k) => STATUSES.find((s) => s.key === k)?.score ?? 0
// ข้อความที่แสดงให้นักเรียนเห็น: กรณีรอบเดือนแสดงเป็น "ได้รับการยกเว้น" เพื่อความเป็นส่วนตัว
export const statusLabel = (k) =>
  k === 'menstruation' ? 'ได้รับการยกเว้น' : STATUSES.find((s) => s.key === k)?.label ?? '—'

export const ATTENDANCE = [
  { key: 'present', label: 'เข้าร่วม' },
  { key: 'absent', label: 'ขาด' },
  { key: 'excused', label: 'ลา' },
]
export const attendanceLabel = (k) => ATTENDANCE.find((s) => s.key === k)?.label ?? '—'

export const GRADES = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6']

export const TIERS = {
  close: 'กลุ่มใกล้ชิด',
  care: 'กลุ่มใส่ใจ',
  develop: 'กลุ่มพัฒนา',
  lead: 'กลุ่มนำ',
}
export const STAGES = { lower: 'ม.ต้น', upper: 'ม.ปลาย' }

export function groupLabel(g) {
  if (!g) return '—'
  return g.name
}

export const pct = (score, checked) => (checked > 0 ? Math.round((Number(score) / checked) * 100) : null)

// ---------- วันที่ (ใช้เวลาท้องถิ่นของเครื่อง) ----------
export function toISO(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}
export const todayISO = () => toISO(new Date())

// วันจันทร์ของสัปดาห์ (ตรงกับ date_trunc('week') ใน Postgres)
export function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00')
  const diff = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - diff)
  return toISO(d)
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function thaiDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
export function thaiShort(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
}

// รายการสัปดาห์ย้อนหลัง n สัปดาห์ (วันจันทร์) เรียงเก่า -> ใหม่ รวมสัปดาห์นี้
export function lastWeeks(n) {
  const thisMon = mondayOf(todayISO())
  return Array.from({ length: n }, (_, i) => addDays(thisMon, -7 * (n - 1 - i)))
}

// วันที่ฮิจเราะฮฺ (คำนวณตามปฏิทินอุมมุลกุรอ ในเบราว์เซอร์ ไม่ต้องใช้เน็ต)
export function hijriToday() {
  try {
    return new Intl.DateTimeFormat('th-TH-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date())
  } catch {
    return null
  }
}

// ---------- หัวข้อรายสัปดาห์ ----------
// หัวข้อของสัปดาห์นี้ ถ้าไม่มีให้เลือกหัวข้อถัดไปที่ใกล้ที่สุด ถ้าหมดแล้วใช้หัวข้อสุดท้าย
export function pickTopic(topics, today = todayISO()) {
  if (!topics?.length) return null
  const mon = mondayOf(today)
  const sorted = [...topics].sort((a, b) => a.session_date.localeCompare(b.session_date))
  return (
    sorted.find((t) => mondayOf(t.session_date) === mon) ??
    sorted.find((t) => t.session_date >= today) ??
    sorted[sorted.length - 1]
  )
}

// ---------- สเตรค ----------
// นับจำนวน "วันที่มีการเช็ค" ติดต่อกันล่าสุดที่ไม่มีวักตูใดเป็น "ไม่ขึ้น"
// (วันที่ไม่มีการเช็ค เช่น วันหยุด จะไม่ตัดสเตรค)
export function calcStreak(checks) {
  const byDate = new Map()
  for (const c of checks) {
    const cur = byDate.get(c.check_date) ?? { absent: false }
    if (c.status === 'absent') cur.absent = true
    byDate.set(c.check_date, cur)
  }
  const dates = [...byDate.keys()].sort().reverse()
  let streak = 0
  for (const d of dates) {
    if (byDate.get(d).absent) break
    streak++
  }
  return streak
}

// ---------- รวมคะแนนรายสัปดาห์จากแถวของ view weekly_scores / rpc group_stats ----------
// rows: [{week_start, score, checked, on_time, late, absent}] ของหลายคนก็ได้ -> รวมต่อสัปดาห์
export function aggregateByWeek(rows, weeks) {
  const map = new Map(weeks.map((w) => [w, { week_start: w, score: 0, checked: 0, on_time: 0, late: 0, absent: 0 }]))
  for (const r of rows) {
    const m = map.get(r.week_start)
    if (!m) continue
    m.score += Number(r.score)
    m.checked += Number(r.checked)
    m.on_time += Number(r.on_time)
    m.late += Number(r.late)
    m.absent += Number(r.absent)
  }
  return weeks.map((w) => map.get(w))
}


// =====================================================
// ฟังก์ชันที่หน้าต่าง ๆ เรียกใช้ (ชื่อสั้นสำหรับหน้าจอ)
// =====================================================
export { IBADAH_ITEMS } from './content.js'

// ค่าที่เก็บในฐานข้อมูลยังเป็น male/female (ระบบสถานะรอบเดือนอ้างอิงค่านี้) เปลี่ยนเฉพาะคำที่แสดง
export const GENDERS = [
  { key: 'male', label: 'มุสลิมีน' },
  { key: 'female', label: 'มุสลิมะฮ์' },
]

// ประเภทกลุ่มฮาลาเกาะฮฺ (เรียงตามลำดับที่แสดง)
export const GROUP_TYPES = ['กลุ่มนำ', 'กลุ่มพัฒนา', 'กลุ่มใส่ใจ', 'กลุ่มใกล้ชิด']

// เพศของกลุ่มในตาราง groups อาจเก็บเป็น male/female หรือ มุสลิมีน/มุสลิมะฮ์ ก็ได้ ว่าง = ทุกเพศ
export function groupGenderKey(v) {
  const s = String(v ?? '').replace(/\s/g, '')
  if (['male', 'มุสลิมีน', 'ชาย'].includes(s)) return 'male'
  if (['female', 'มุสลิมะฮ์', 'มุสลิมะฮฺ', 'หญิง'].includes(s)) return 'female'
  return null
}
// ชั้นของกลุ่มอาจเป็น ม.6 หรือ ม.ต้น/ม.ปลาย ว่าง = ทุกชั้น
export function groupMatchesGrade(g, grade) {
  const v = String(g?.grade ?? '').replace(/\s/g, '')
  return !v || v === grade || v === stageOf(grade)
}
// ชื่อมูร๊อบบีย์ของกลุ่ม (ตัดช่องว่างและ "-")
export const murabbiNames = (g) =>
  [g?.murabbi_1, g?.murabbi_2].map((x) => String(x ?? '').trim()).filter((x) => x && x !== '-')
// ชั้น/ห้อง สำหรับแสดงผล (นักเรียนใหม่ไม่มีห้องแล้ว)
export const gradeRoom = (s) => (s?.class_room ? `${s.grade ?? ''}/${s.class_room}` : s?.grade ?? '')

// ม.1-3 = ม.ต้น, ม.4-6 = ม.ปลาย (ตรงกับค่า stage ในตาราง groups)
export function stageOf(grade) {
  const n = Number(String(grade ?? '').replace(/\D/g, ''))
  if (!n) return null
  return n <= 3 ? 'ม.ต้น' : 'ม.ปลาย'
}

// ตัวเลือกสถานะละหมาด: "รอบเดือน" แสดงเฉพาะนักเรียนหญิง
export const statusesFor = (gender) =>
  STATUSES.filter((s) => s.key !== 'menstruation' || gender === 'female')

export const scoreOf = statusScore
export const shortDate = thaiShort
export const weekRange = lastWeeks

export function firstName(full) {
  return String(full ?? '').trim().split(/\s+/)[0] || ''
}

// รวมคะแนนละหมาดรายสัปดาห์ของตัวเอง: { 'YYYY-MM-DD(จันทร์)': { score, checked } }
export function weeklyAgg(checks) {
  const out = {}
  for (const c of checks ?? []) {
    const w = mondayOf(c.check_date)
    const cur = (out[w] ??= { score: 0, checked: 0 })
    cur.score += statusScore(c.status)
    cur.checked += 1
  }
  return out
}

// วันที่ฮิจเราะฮฺของวันที่ที่กำหนด (ปฏิทินอุมมุลกุรอ คำนวณในเบราว์เซอร์)
export function hijriOf(date) {
  try {
    const parts = new Intl.DateTimeFormat('th-TH-u-ca-islamic-umalqura', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).formatToParts(date)
    const get = (t) => parts.find((p) => p.type === t)?.value
    return { day: get('day'), monthName: get('month'), year: get('year') }
  } catch {
    return null
  }
}

// =====================================================
// CSV (เปิดใน Excel ได้ — ใส่ BOM ให้ภาษาไทยไม่เพี้ยน)
// =====================================================
const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCSV = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n')

export function downloadCSV(filename, rows) {
  const blob = new Blob(['﻿' + toCSV(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// อ่าน CSV/TSV (รองรับเครื่องหมายคำพูด ขึ้นบรรทัดใหม่ในช่อง และไฟล์ที่ Excel บันทึกแบบ UTF-8)
export function parseCSV(text) {
  const src = String(text ?? '').replace(/^﻿/, '')
  const first = src.split(/\r?\n/, 1)[0] ?? ''
  const delim = first.includes('\t') ? '\t' : ','
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}

// ต้นปีการศึกษา (1 พ.ค.) ของวันที่ที่กำหนด
export function academicYearStart(iso = todayISO()) {
  const y = Number(iso.slice(0, 4))
  const m = Number(iso.slice(5, 7))
  return `${m >= 5 ? y : y - 1}-05-01`
}
export const toBuddhistYear = (iso) => String(Number(iso.slice(0, 4)) + 543)
