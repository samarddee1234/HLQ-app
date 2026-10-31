import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Vent({ profile }) {
  const [content, setContent] = useState('')
  const [messages, setMessages] = useState([])
  const [replyText, setReplyText] = useState({})
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  const isStaff = profile?.role === 'admin' || profile?.role === 'murabbi'

  // ดึงข้อความมาแสดง
  const fetchMessages = async () => {
    let query = supabase
      .from('anonymous_messages')
      .select('*')
      .order('created_at', { ascending: false })

    // ถ้าเป็นนักเรียน/ศิษย์เก่าทั่วไป ให้เห็นเฉพาะข้อความที่เผยแพร่แล้ว
    if (!isStaff) {
      query = query.eq('is_published', true)
    }

    const { data, error } = await query
    if (!error && data) {
      setMessages(data)
    }
  }

  useEffect(() => {
    fetchMessages()
  }, [isStaff])

  // นักเรียนส่งข้อความนิรนาม
  const handleSend = async (e) => {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setMsg('')

    const { error } = await supabase.from('anonymous_messages').insert([
      { content: content.trim(), is_published: false }
    ])

    setLoading(false)
    if (error) {
      setMsg('เกิดข้อผิดพลาดในการส่ง กรุณาลองใหม่')
    } else {
      setContent('')
      setMsg('ส่งข้อความนิรนามเรียบร้อยแล้ว มูร็อบบีย์จะเข้ามาอ่านและตอบให้นะ')
      fetchMessages()
    }
  }

  // แอดมิน/มูร็อบบีย์ พิมพ์ตอบกลับ
  const handleSaveReply = async (id) => {
    const text = replyText[id]
    if (!text || !text.trim()) return

    const { error } = await supabase
      .from('anonymous_messages')
      .update({
        reply: text.trim(),
        replied_at: new Date().toISOString(),
        is_published: true
      })
      .eq('id', id)

    if (!error) {
      fetchMessages()
    }
  }

  return (
    <div className="center" style={{ padding: '1rem', maxWidth: '640px', margin: '0 auto' }}>
      <div className="card narrow" style={{ width: '100%', marginBottom: '1.5rem' }}>
        <h2>กล่องระบายใจ & ถามข้อสงสัย (นิรนาม)</h2>
        <p className="muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
          ส่งข้อความได้โดยไม่ต้องระบุชื่อ ข้อมูลจะถูกเก็บเป็นความลับ 100% คำถามหรือข้อคิดที่ดีจะได้รับคำตอบจากมูร็อบบีย์เพื่อแบ่งปันประโยชน์แก่ทุกคน
        </p>

        <form onSubmit={handleSend}>
          <textarea
            required
            rows={4}
            placeholder="พิมพ์สิ่งที่อยากปรึกษา ระบาย หรือคำถามที่สงสัยที่นี่..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box' }}
          />

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ marginTop: '0.75rem', width: '100%' }}
          >
            {loading ? 'กำลังส่ง...' : 'ส่งข้อความนิรนาม'}
          </button>
        </form>

        {msg && <p style={{ marginTop: '0.75rem', color: '#10b981', fontSize: '0.9rem' }}>{msg}</p>}
      </div>

      {/* พื้นที่แสดงรายการคำถาม-คำตอบ */}
      <div style={{ width: '100%' }}>
        <h3 style={{ marginBottom: '1rem' }}>💬 รวมคำถาม-คำตอบ & กำลังใจ</h3>

        {messages.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', fontSize: '0.9rem' }}>
            ยังไม่มีข้อความตอบกลับในขณะนี้
          </p>
        ) : (
          messages.map((item) => (
            <div
              key={item.id}
              className="card narrow"
              style={{
                width: '100%',
                marginBottom: '1rem',
                textAlign: 'left',
                borderLeft: '4px solid #10b981'
              }}
            >
              <div style={{ marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  {new Date(item.created_at).toLocaleDateString('th-TH')}
                </span>
                <p style={{ marginTop: '0.25rem', fontSize: '0.95rem', fontWeight: '500' }}>
                  💭 "{item.content}"
                </p>
              </div>

              {item.reply ? (
                <div style={{ background: '#f0fdf4', padding: '0.75rem', borderRadius: '6px', marginTop: '0.5rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#047857', marginBottom: '0.25rem' }}>
                    🌿 มูร็อบบีย์ตอบกลับ:
                  </p>
                  <p style={{ fontSize: '0.9rem', color: '#1f2937', margin: 0 }}>
                    {item.reply}
                  </p>
                </div>
              ) : (
                isStaff && (
                  <p style={{ fontSize: '0.8rem', color: '#ef4444' }}>
                    * ยังไม่ได้ตอบกลับ (ยังไม่แสดงให้นักเรียนเห็น)
                  </p>
                )
              )}

              {/* ส่วนตอบกลับเฉพาะแอดมินหรือมูร็อบบีย์ */}
              {isStaff && (
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid #eee', paddingTop: '0.75rem' }}>
                  <input
                    type="text"
                    placeholder="พิมพ์ตอบกลับเพื่อเผยแพร่ลงบอร์ด..."
                    value={replyText[item.id] !== undefined ? replyText[item.id] : (item.reply || '')}
                    onChange={(e) => setReplyText({ ...replyText, [item.id]: e.target.value })}
                    style={{ width: '70%', padding: '0.4rem', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  <button
                    type="button"
                    className="btn"
                    onClick={() => handleSaveReply(item.id)}
                    style={{ marginLeft: '0.5rem', padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    บันทึกคำตอบ
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}