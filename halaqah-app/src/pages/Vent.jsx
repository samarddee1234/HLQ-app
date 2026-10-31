import { useState } from 'react'
import { supabase } from '../supabase.js'

const TOPICS = ['เรื่องเรียน', 'ครอบครัว', 'เพื่อน', 'ความรู้สึก/จิตใจ', 'หอพัก', 'อื่น ๆ']

export default function Vent() {
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.from('anonymous_messages').insert({ body: body.trim(), topic: topic || null })
    setBusy(false)
    if (error) return setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง')
    setBody('')
    setTopic('')
    setSent(true)
  }

  return (
    <>
      <section className="card">
        <h3>ระบายใจแบบไม่ระบุตัวตน</h3>
        <p>ระบบไม่บันทึกชื่อ บัญชี หรือกลุ่มของผู้ส่งไว้กับข้อความ ผู้ดูแลที่ได้รับมอบหมายเท่านั้นที่อ่านได้ และอาจไม่ตอบกลับรายบุคคล</p>
        {sent ? (
          <>
            <p className="msg"><b>ส่งเรียบร้อยแล้ว</b> ขอบคุณที่ไว้ใจเล่าให้ฟัง</p>
            <button className="btn ghost small" onClick={() => setSent(false)}>เขียนข้อความใหม่</button>
          </>
        ) : (
          <form onSubmit={send}>
            <div className="chips" role="group" aria-label="หัวข้อ (ไม่บังคับ)">
              {TOPICS.map((t) => (
                <button type="button" key={t} className={`chip ${topic === t ? 'on' : ''}`}
                  onClick={() => setTopic(topic === t ? '' : t)}>{t}</button>
              ))}
            </div>
            <label className="field">ข้อความ (ไม่เกิน 1,000 ตัวอักษร)
              <textarea required maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>
            <button className="btn" disabled={busy || !body.trim()}>ส่งแบบไม่ระบุตัวตน</button>
            {err && <p className="msg err">{err}</p>}
          </form>
        )}
      </section>

      <section className="card">
        <h3>ถ้ารู้สึกไม่ปลอดภัย</h3>
        <p>หากคุณกำลังคิดทำร้ายตัวเอง หรือมีใครทำให้คุณไม่ปลอดภัย กรุณาบอกครูหรือผู้ใหญ่ที่ไว้ใจทันที ข้อความนิรนามอาจไม่ถูกอ่านทันที</p>
        <p>สายด่วนสุขภาพจิต <b>1323</b> (กรมสุขภาพจิต) โทรฟรีตลอด 24 ชั่วโมง</p>
        <a className="btn ghost small" href="tel:1323" style={{ display: 'inline-block', textDecoration: 'none' }}>โทร 1323</a>
      </section>
    </>
  )
}
