import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { thaiDate } from '../lib.js'

// กล่องข้อความนิรนาม ใช้ร่วมกัน: มูร๊อบบีย์เห็นเฉพาะที่ส่งถึงกลุ่มตัวเอง (บังคับที่ฐานข้อมูล) / แอดมินเห็นทั้งหมด
export default function VentInbox({ admin = false }) {
  const [rows, setRows] = useState(null)
  const [groups, setGroups] = useState({})
  const [filter, setFilter] = useState('new')
  const [msg, setMsg] = useState('')

  async function load() {
    const { data, error } = await supabase.from('anonymous_messages').select('*').order('created_at', { ascending: false }).limit(100)
    if (error) setMsg('โหลดไม่ได้ — แอดมินต้องรัน migration_06.sql ก่อน')
    setRows(data ?? [])
    if (admin) {
      const g = await supabase.from('groups').select('id,name')
      setGroups(Object.fromEntries((g.data ?? []).map((x) => [x.id, x.name])))
    }
  }
  useEffect(() => { load() }, [])

  const edit = (id, k, v) => setRows(rows.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  async function manage(r, reply) {
    const status = reply != null && r.status === 'new' ? 'seen' : r.status
    const { error } = await supabase.rpc('vent_manage', { p_id: r.id, p_status: status, p_note: r.admin_note ?? '', p_reply: reply })
    setMsg(error ? error.message : reply != null ? 'ส่งคำตอบแล้ว นักเรียนจะเห็นในเครื่องของเขา' : 'บันทึกแล้ว')
    if (!error) load()
  }
  async function purge() {
    if (!window.confirm('ลบข้อความที่เก่ากว่า 180 วันทั้งหมด? ลบแล้วกู้คืนไม่ได้')) return
    const { data, error } = await supabase.rpc('vent_purge', { p_days: 180 })
    setMsg(error ? error.message : `ลบแล้ว ${data} ข้อความ`)
    load()
  }

  const list = (rows ?? []).filter((r) => (filter === 'new' ? r.status === 'new' : true))
  const newCount = (rows ?? []).filter((r) => r.status === 'new').length

  return (
    <section className="card">
      <h3>ข้อความนิรนามจากนักเรียน</h3>
      <p className="muted">
        {admin
          ? 'แอดมินเห็นทุกข้อความ ควรมอบหมายผู้ดูแลที่เหมาะสม (เช่น ครูแนะแนว) ตรวจทุกวัน '
          : 'แสดงเฉพาะข้อความที่นักเรียนเลือกส่งถึงกลุ่มของคุณ คุณจะไม่เห็นว่าใครเป็นผู้ส่ง '}
        หากข้อความสื่อถึงอันตราย ให้ปรึกษาแอดมินหรือครูแนะแนวเพื่อวางแผนช่วยเหลือโดยไม่เปิดเผยตัวผู้ส่งเกินจำเป็น และอย่าพยายามสืบหาว่าใครเป็นผู้เขียน
      </p>
      <div className="chips">
        <button className={`chip ${filter === 'new' ? 'on' : ''}`} onClick={() => setFilter('new')}>ใหม่ ({newCount})</button>
        <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>ทั้งหมด</button>
      </div>
      {msg && <p className="msg" role="status">{msg}</p>}
      {rows === null && <p className="muted">กำลังโหลด…</p>}
      {rows && list.length === 0 && <p className="muted">{filter === 'new' ? 'ไม่มีข้อความใหม่' : 'ยังไม่มีข้อความ'}</p>}
      {list.map((r) => (
        <div key={r.id} className="post">
          <div>{r.body}</div>
          <div className="muted">
            {thaiDate(r.created_at.slice(0, 10))}
            {r.mood ? ` · รู้สึก${r.mood}` : ''}{r.topic ? ` · ${r.topic}` : ''}
            {admin && ` · ถึง${r.audience === 'group' ? `กลุ่ม ${groups[r.group_id] ?? ''}` : 'ผู้ดูแลส่วนกลาง'}`}
          </div>
          <div className="row" style={{ marginTop: 6 }}>
            <select aria-label="สถานะ" style={{ width: 'auto' }} value={r.status} onChange={(e) => edit(r.id, 'status', e.target.value)}>
              <option value="new">ใหม่</option><option value="seen">อ่านแล้ว</option><option value="followed">ติดตามแล้ว</option>
            </select>
            <input className="grow" aria-label="บันทึกของผู้ดูแล" placeholder="บันทึกของผู้ดูแล (นักเรียนไม่เห็น)" value={r.admin_note ?? ''} onChange={(e) => edit(r.id, 'admin_note', e.target.value)} />
            <button className="btn small" onClick={() => manage(r, null)}>บันทึก</button>
          </div>
          {r.reply_token ? (
            <div style={{ marginTop: 6 }}>
              <label className="field" style={{ margin: 0 }}>{r.replied_at ? `ตอบแล้ว ${thaiDate(r.replied_at.slice(0, 10))} (แก้แล้วส่งใหม่ได้)` : 'คำตอบถึงนักเรียน'}
                <textarea maxLength={2000} value={r.reply ?? ''} onChange={(e) => edit(r.id, 'reply', e.target.value)} style={{ minHeight: 70 }} />
              </label>
              <button className="btn small" disabled={!(r.reply ?? '').trim()} onClick={() => manage(r, r.reply)}>ส่งคำตอบ</button>
            </div>
          ) : (
            <p className="muted">ข้อความเก่า ไม่มีรหัสตอบกลับ ตอบไม่ได้</p>
          )}
        </div>
      ))}
      {admin && (
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn ghost small" onClick={purge}>ลบข้อความเก่ากว่า 180 วัน</button>
        </div>
      )}
    </section>
  )
}
