import { useState } from 'react'
import { supabase } from '../supabase.js'

export default function Login() {
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    const { data, error } =
      mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (error) return setMsg(error.message)
    if (mode === 'signup' && !data.session) {
      setMsg('สมัครสำเร็จ กรุณาตรวจอีเมลเพื่อยืนยันบัญชี แล้วกลับมาเข้าสู่ระบบ')
    }
  }

  return (
    <div className="center">
      <form className="card narrow" onSubmit={submit}>
        <h1>สายใยสามารถดี</h1>
        <p className="muted">ระบบฮาลาเกาะฮฺ โรงเรียนสามารถดีวิทยา</p>
        <h3>{mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครบัญชีใหม่'}</h3>
        <label className="field">อีเมล
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">รหัสผ่าน (อย่างน้อย 6 ตัว)
          <input type="password" required minLength={6} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>{mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัคร'}</button>
        {msg && <p className="msg">{msg}</p>}
        <button type="button" className="btn link" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMsg('') }}>
          {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครใหม่' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
