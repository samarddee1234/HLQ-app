import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase.js'
import { thaiDate, todayISO, toISO } from '../lib.js'

// กระดิ่งแจ้งเตือนในแอป: นับ "สิ่งใหม่" ตั้งแต่ครั้งสุดท้ายที่เปิดกระดิ่ง (จำในเครื่องของแต่ละคน)
// ยังไม่ใช่ push ตอนปิดแอป — ต้องเปิดแอปจึงเห็น
const key = (id) => `notif-seen:${id}`
const readSeen = (id) => { try { return localStorage.getItem(key(id)) } catch { return null } }

async function collect(profile) {
  const items = []
  const since = readSeen(profile.id) ?? new Date(Date.now() - 7 * 864e5).toISOString()
  const add = (kind, title, body, at) => items.push({ id: `${kind}:${at}:${title}`, title, body, at, fresh: at > since })

  if (profile.role === 'alumni') {
    const { data } = await supabase.from('alumni_posts').select('id,kind,title,event_at,created_at').order('created_at', { ascending: false }).limit(15)
    for (const p of data ?? []) {
      if (p.kind === 'online_halaqah' && p.event_at && toISO(new Date(p.event_at)) === todayISO()) {
        items.push({ id: `today:${p.id}`, title: 'วันนี้มีฮาลาเกาะฮฺออนไลน์', body: p.title, at: new Date().toISOString(), fresh: true, pinned: true })
        continue
      }
      add('ap', p.title, p.kind === 'knowledge' ? 'ความรู้ใหม่จากมูร๊อบบีย์' : p.kind === 'announcement' ? 'ประกาศใหม่' : 'นัดหมายใหม่', p.created_at)
    }
  } else if (profile.role === 'admin') {
    const [u, m] = await Promise.all([
      supabase.from('profiles').select('id').in('requested_role', ['murabbi', 'alumni']).eq('role', 'student').eq('registered', true).limit(50),
      supabase.from('anonymous_messages').select('id').eq('status', 'new').limit(50),
    ])
    const nu = u.data?.length ?? 0, nm = m.data?.length ?? 0
    if (nu) items.push({ id: 'pending', title: `มี ${nu} คนรออนุมัติ`, body: 'ดูที่ แอดมิน > ผู้ใช้', at: new Date().toISOString(), fresh: true, pinned: true })
    if (nm) items.push({ id: 'msgs', title: `ข้อความระบายใจใหม่ ${nm} ข้อความ`, body: 'ดูที่ แอดมิน > ข้อความนิรนาม', at: new Date().toISOString(), fresh: true, pinned: true })
  } else if (profile.group_id) {
    const [p, s] = await Promise.all([
      supabase.from('group_posts').select('id,title,body,created_at').eq('group_id', profile.group_id).order('created_at', { ascending: false }).limit(10),
      supabase.from('weekly_summaries').select('id,week_start,updated_at').eq('group_id', profile.group_id).order('updated_at', { ascending: false }).limit(5),
    ])
    for (const x of p.data ?? []) add('gp', x.title || (x.body ?? '').slice(0, 60), 'ประกาศจากกลุ่ม', x.created_at)
    if (profile.role === 'student') {
      for (const x of s.data ?? []) add('ws', `สรุปฮาลาเกาะฮฺสัปดาห์ ${thaiDate(x.week_start)}`, 'มูร๊อบบีย์ลงสรุปแล้ว', x.updated_at)
    }
  }
  return items.sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.at.localeCompare(a.at)).slice(0, 12)
}

export default function Notifications({ profile }) {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const box = useRef(null)

  useEffect(() => {
    let alive = true
    const load = () => collect(profile).then((x) => alive && setItems(x)).catch(() => {})
    load()
    const t = setInterval(load, 5 * 60 * 1000)
    const vis = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', vis)
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }, [profile.id, profile.group_id, profile.role])

  useEffect(() => {
    if (!open) return
    const off = (e) => { if (box.current && !box.current.contains(e.target)) close() }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])

  const count = items.filter((i) => i.fresh).length
  function close() {
    setOpen(false)
    try { localStorage.setItem(key(profile.id), new Date().toISOString()) } catch { /* ignore */ }
    setItems((xs) => xs.map((i) => (i.pinned ? i : { ...i, fresh: false })))
  }

  return (
    <div className="bell" ref={box}>
      <button className="btn light bell-btn" onClick={() => (open ? close() : setOpen(true))}
        aria-label={`การแจ้งเตือน${count ? ` ${count} รายการใหม่` : ''}`} aria-expanded={open}>
        🔔{count > 0 && <span className="bell-dot">{count > 9 ? '9+' : count}</span>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label="การแจ้งเตือน">
          <b>การแจ้งเตือน</b>
          {items.length === 0 && <p className="muted">ยังไม่มีการแจ้งเตือน</p>}
          {items.map((i) => (
            <div key={i.id} className={`bell-item ${i.fresh ? 'fresh' : ''}`}>
              <div>{i.title}</div>
              <small className="muted">{i.body}{!i.pinned && ` · ${thaiDate(toISO(new Date(i.at)))}`}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
