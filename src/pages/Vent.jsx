import { useEffect, useState } from 'react'
import { supabase } from '../supabase.js'
import { thaiDate } from '../lib.js'
import { readTokens, saveTokens, newToken } from '../ventTokens.js'

const TOPICS = ['เรื่องเรียน', 'ครอบครัว', 'เพื่อน', 'ความรู้สึก/จิตใจ', 'หอพัก', 'อื่น ๆ']
export const MOODS = ['สบายดี', 'เหนื่อย', 'กังวล', 'เศร้า', 'หงุดหงิด', 'เหงา']

export default function Vent({ profile }) {
  const hasGroup = Boolean(profile?.group_id)
  const [body, setBody] = useState('')
  const [topic, setTopic] = useState('')
  const [mood, setMood] = useState('')
  const [audience, setAudience] = useState(hasGroup ? 'group' : 'admin')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [mine, setMine] = useState(null)

  async function loadMine() {
    const tokens = readTokens()
    if (!tokens.length) return setMine([])
    const { data } = await supabase.rpc('my_vent_replies', { p_tokens: tokens })
    setMine(data ?? [])
  }
  useEffect(() => { loadMine() }, [])

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const token = newToken()
    const { error } = await supabase.from('anonymous_messages').insert({
      body: body.trim(), topic: topic || null, mood: mood || null, reply_token: token,
      audience, group_id: audience === 'group' ? profile.group_id : null,
    })
    setBusy(false)
    if (error) return setErr('ส่งไม่สำเร็จ ลองใหม่อีกครั้ง (ถ้ายังไม่ได้ ให้แจ้งแอดมิน)')
    saveTokens([...readTokens(), token])
    setBody(''); setTopic(''); setMood('')
    setSent(true)
    loadMine()
  }

  return (
    <>
      <section className="card">
        <h3>วันนี้คุณรู้สึกอย่างไร?</h3>
        <p className="muted">ที่นี่เป็นพื้นที่ปลอดภัยให้เล่าเรื่องที่หนักใจ ไม่ต้องบอกชื่อ</p>
        {sent ? (
          <>
            <p className="msg"><b>ส่งเรียบร้อยแล้ว</b> ขอบคุณที่ไว้ใจเล่าให้ฟัง กลับมาดูคำตอบได้ที่หน้านี้</p>
            <button className="btn ghost small" onClick={() => setSent(false)}>เขียนข้อความใหม่</button>
          </>
        ) : (
          <form onSubmit={send}>
            <div className="chips" role="group" aria-label="อารมณ์วันนี้ (ไม่บังคับ)">
              {MOODS.map((m) => (
                <button type="button" key={m} className={`chip ${mood === m ? 'on' : ''}`} aria-pressed={mood === m}
                  onClick={() => setMood(mood === m ? '' : m)}>{m}</button>
              ))}
            </div>
            <div className="chips" role="group" aria-label="หัวข้อ (ไม่บังคับ)">
              {TOPICS.map((t) => (
                <button type="button" key={t} className={`chip ${topic === t ? 'on' : ''}`} aria-pressed={topic === t}
                  onClick={() => setTopic(topic === t ? '' : t)}>{t}</button>
              ))}
            </div>
            <label className="field">ข้อความ (ไม่เกิน 1,000 ตัวอักษร)
              <textarea required maxLength={1000} value={body} onChange={(e) => setBody(e.target.value)} />
            </label>

            <fieldset className="aud">
              <legend>ส่งถึงใคร</legend>
              <label className={`aud-opt ${audience === 'group' ? 'on' : ''} ${hasGroup ? '' : 'off'}`}>
                <input type="radio" name="aud" checked={audience === 'group'} disabled={!hasGroup} onChange={() => setAudience('group')} />
                <span><b>มูร๊อบบีย์กลุ่มของฉัน</b><small>ครูในกลุ่มจะอ่านและตอบได้ ท่านจะรู้ว่าข้อความมาจากกลุ่มนี้ แต่ไม่รู้ว่าใครเป็นคนส่ง</small></span>
              </label>
              <label className={`aud-opt ${audience === 'admin' ? 'on' : ''}`}>
                <input type="radio" name="aud" checked={audience === 'admin'} onChange={() => setAudience('admin')} />
                <span><b>ผู้ดูแลส่วนกลาง</b><small>ไม่ผูกกับกลุ่มใดเลย เหมาะกับเรื่องที่ไม่อยากให้ครูในกลุ่มรู้</small></span>
              </label>
            </fieldset>

            <p className="muted">ระบบไม่บันทึกชื่อหรือบัญชีของคุณไว้กับข้อความ แต่แอดมินระบบอาจอ่านข้อความได้เพื่อความปลอดภัย และหากเขียนข้อมูลที่ระบุตัวคุณได้ ผู้อ่านก็อาจเดาได้</p>
            <button className="btn" disabled={busy || !body.trim()}>ส่งแบบไม่ระบุตัวตน</button>
            {err && <p className="msg err" role="alert">{err}</p>}
          </form>
        )}
      </section>

      {mine && mine.length > 0 && (
        <section className="card">
          <h3>ข้อความของฉัน</h3>
          {mine.map((m) => (
            <div key={m.reply_token} className="post">
              <div>{m.body}</div>
              <div className="muted">{thaiDate(m.created_at.slice(0, 10))}{m.topic ? ` · ${m.topic}` : ''} · ส่งถึง{m.audience === 'group' ? 'มูร๊อบบีย์กลุ่ม' : 'ผู้ดูแลส่วนกลาง'}</div>
              {m.reply
                ? <div className="reply"><b>คำตอบ</b><div className="pre">{m.reply}</div></div>
                : <div className="muted">รอผู้ดูแลอ่านและตอบ</div>}
            </div>
          ))}
          <p className="muted">ดูข้อความและคำตอบได้เฉพาะในเครื่องและแอป/เบราว์เซอร์ที่ใช้ส่ง ถ้าเปลี่ยนเครื่องหรือล้างข้อมูลเบราว์เซอร์ จะดูของเก่าไม่ได้ (บน iPhone แอปที่ติดตั้งบนหน้าจอกับ Safari แยกกัน)</p>
        </section>
      )}

      <section className="card">
        <h3>ถ้ารู้สึกไม่ปลอดภัย</h3>
        <p>หากคุณกำลังคิดทำร้ายตัวเอง หรือมีใครทำให้คุณไม่ปลอดภัย กรุณาบอกครูหรือผู้ใหญ่ที่ไว้ใจทันที ข้อความนิรนามอาจไม่ถูกอ่านทันที</p>
        <p>สายด่วนสุขภาพจิต <b>1323</b> (กรมสุขภาพจิต) โทรฟรีตลอด 24 ชั่วโมง</p>
        <a className="btn ghost small" href="tel:1323" style={{ display: 'inline-block', textDecoration: 'none' }}>โทร 1323</a>
      </section>
    </>
  )
}
