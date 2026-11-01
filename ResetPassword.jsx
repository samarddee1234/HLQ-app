import { useState } from 'react'
import { supabase } from '../supabase.js'
import Mascot from '../components/Mascot.jsx'

// แสดงหลังกดลิงก์ "ตั้งรหัสผ่านใหม่" จากอีเมล
export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (pw !== pw2) return setMsg('รหัสผ่านสองช่องไม่ตรงกัน')
    setBusy(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) return setMsg('ตั้งรหัสผ่านไม่สำเร็จ ลองขอลิงก์ใหม่อีกครั้ง')
    onDone()
  }
  return (
    <div className="center auth">
      <form className="card narrow auth-card" onSubmit={submit}>
        <Mascot size={80} />
        <h2>ตั้งรหัสผ่านใหม่</h2>
        <label className="field">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)
          <input type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </label>
        <label className="field">ยืนยันรหัสผ่านใหม่
          <input type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>บันทึกรหัสผ่านใหม่</button>
        {msg && <p className="msg err" role="alert">{msg}</p>}
      </form>
    </div>
  )
}
